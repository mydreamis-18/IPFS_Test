const AWS_PATH =
  "http://ec2-13-125-242-193.ap-northeast-2.compute.amazonaws.com";
const BACK_FILE_FOLDER_NAME = "multerFiles";

// .jsipfs 폴더의 config 파일 주소 수정
const AWS_PRIVATE_IP = "172.31.0.61";

const AWS_PUBLIC_IP = "3.34.252.250";
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
const app = express();
const PORT = 8282;

// Create a factory to spawn two test disposable controllers, get access to an IPFS api
// print node ids and clean all the controllers from the factory.
// (async () => {
//   const Ctl = await import('ipfsd-ctl');

//   const factory = Ctl.createFactory(
//     {
//       type: 'js',
//       test: true,
//       disposable: true,
//       ipfsHttpModule: await import("ipfs-http-client"),
//       ipfsModule: await import('ipfs') // only if you gonna spawn 'proc' controllers
//     },
//     { // overrides per type
//       js: {
//         ipfsBin:  (await import('ipfs')).path()
//       },
//     }
//   )
//   const ipfsd1 = await factory.spawn() // Spawns using options from `createFactory`

//   console.log(await ipfsd1.api.id())

//   // await factory.clean() // Clean all the controllers created by the factory calling `stop` on all of them.
// })();

// 비동기 방식인 ES 모듈을 커먼 JS로 가져오기
let ipfs, globSource;

const createIpfsClientFn = async () => {
  //
  const { create, globSource } = await import("ipfs-http-client");
  return { create, globSource };
};

(async () => {
  //
  if (ipfs !== undefined) return;

  const ipfsClient = await createIpfsClientFn();

  // daemon IP 주소와 동일해야 함
  ipfs = ipfsClient.create({
    host: AWS_PRIVATE_IP,
    protocol: "http",
    port: "5002",
  });

  globSource = ipfsClient.globSource;
})();

app.use(express.json());
app.use(cors({ origin: [`http://${AWS_PRIVATE_IP}:3000`, `${AWS_PATH}:3000`] }));

app.listen(PORT, () => console.log("back server start..."));

// ipfs에 저장할 파일들의 백 경로 (테스트용 전역 변수)
let filePaths = new Array(0);

let fileOriginalNames = new Array(0);

// 파일 저장할 백 폴더 생성
const isFolder = fs.existsSync(BACK_FILE_FOLDER_NAME);
if (!isFolder) {
  //
  fs.mkdirSync(BACK_FILE_FOLDER_NAME);
}

app.post("/saveFiles", multer().array("files"), async (req, res) => {
  //
  req.files.map((file) => {
    //
    const fileName = decodeURIComponent(file.originalname);
    const filePath = path.join(BACK_FILE_FOLDER_NAME, fileName);

    fs.writeFileSync(filePath, file.buffer);

    fileOriginalNames.push(fileName);
    filePaths.push(filePath);
  });

  res.send({ success: true, msg: "모든 첨부 파일 저장 완료!" });
});

app.post("/saveIpfs", async (req, res) => {
  //
  if (ipfs === undefined) {
    res.send({
      success: false,
      msg: "ipfs 모듈이 import 중이니 잠시 후 다시 시도해주세요.",
    });
    return;
  }

  const ipfsPaths = new Array(0);
  const ipfsResult = new Array(0);
  const fileBuffers = new Array(0);

  try {
    //
    await Promise.all(
      filePaths.map(async (filePath) => {
        //
        // 두 번재 인자인 파일 이름에 [] 기호가 포함될 경우 오류가 발생하기 때문에 첫 번째 인자에 파일 이름까지 기재
        for await (const iterator of ipfs.addAll(
          globSource(filePath, "**/*")
        )) {
          //
          // { path, cid, size, mode }
          ipfsResult.push(iterator);

          // ["code", "version", "multihash", "bytes", "/"];
          // console.log(Object.keys(iterator.cid));

          // true
          // console.log(iterator.path === iterator.cid.toString());

          // 블록체인에 저장할 ipfs 경로 (daemon IP 주소와 동일해야 함)
          const cidPath = `http://${AWS_PUBLIC_IP}:9090/ipfs/${iterator.cid}`;
          ipfsPaths.push(cidPath);
        }

        // 백에 저장된 파일의 버퍼 값
        const buffer = fs.readFileSync(filePath);
        fileBuffers.push(buffer);
      })
    );
  } catch (error) {
    //
    res.send({
      success: false,
      msg: "저장된 파일의 경로와 jsipfs daemon의 실행 여부를 다시 한 번 확인해주세요.",
    });
    return;
  }

  // 백 파일의 버퍼 값 (테스트용)
  console.log(fileBuffers);

  // 파일 다운로드 가능한 주소 (xlsx, docx 파일을 제외하고는 확장자 없이 다운로드됨)
  console.log(ipfsPaths);

  console.log(ipfsResult);

  res.send({
    success: true,
    data: { fileOriginalNames, ipfsPaths, ipfsResult },
  });
});

app.post("/downloadIpfs", async (req, res) => {
  //
  const { fileOriginalName, cid } = req.body;

  let iwantbuffer;

  for await (const chunk of ipfs.cat(cid)) {
    console.info(chunk);
    iwantbuffer = chunk;
  }

  // fs.writeFileSync(path.join("ipfsFiles", fileOriginalName), iwantbuffer);

  res.send(iwantbuffer);
});

app.post("/downloadBackFile", (req, res) => {
  //
  const { encodedFileName: fileName } = req.body;

  const fileOriginalName = decodeURIComponent(fileName);
  const filePath = path.join(
    __dirname,
    BACK_FILE_FOLDER_NAME,
    fileOriginalName
  );

  // 해당 백 경로에 파일이 없을 경우
  const isMissingFile = !fs.existsSync(filePath);
  if (isMissingFile) {
    //
    // blob 타입으로 전송
    res.send();
    return;
  }

  res.sendFile(filePath);
  // res.download(filePath);
});

app.get("/deleteBackFiles", (req, res) => {
  //
  const fileNames = fs.readdirSync(path.join(__dirname, BACK_FILE_FOLDER_NAME));

  fileNames.forEach((fileName) => {
    //
    try {
      //
      fs.unlinkSync(path.join(BACK_FILE_FOLDER_NAME, fileName));
    } catch (err) {
      //
      console.log(err);
    }
  });
  res.send({ success: true, msg: "모든 파일 삭제 완료!" });
});

// ===========================================================================
// =============================== 사용 안 함 =================================
app.post("/saveIpfsWithMulter", multer().array("files"), async (req, res) => {
  //
  // console.log(ipfs === undefined)
  // while (true) {
  //     if (ipfs !== undefined) {
  //         break;
  //     }
  // }

  if (ipfs === undefined) {
    res.send({
      success: false,
      msg: "ipfs 모듈 import 중이니 잠시 후 다시 시도해주세요.",
    });
    return;
  }

  console.log(req.files);
  console.log(req.files.length);

  const imgsData = new Array(0);

  try {
    //
    await Promise.all(
      req.files.map(async (file) => {
        //
        const ipfsReuslt = await ipfs.add({
          path: decodeURIComponent(file.originalname),
          content: file.buffer,
        });
        imgsData.push(ipfsReuslt);
      })
    );
  } catch (error) {
    //
    res.send({
      success: false,
      msg: "ipfs daemon이 실행 중인지 확인해주세요.",
    });
    return;
  }

  // 해당 경로의 모든 jpg 파일 저장
  // const imgPaths = new Array(0);
  // for await (const iterator of ipfs.addAll(globSource("./", "**/*.jpg"))) {
  //     imgPaths.push("http://localhost:9090/ipfs/" + iterator.cid);
  // }
  // console.log(imgPaths);

  // const string = await ipfs.add("string");
  // const stringPath = "https://ipfs.io/ipfs/" + string.cid;
  // console.log(stringPath);

  console.log(imgsData);
  res.send({ success: true, data: imgsData });
});

// =================================
// =========== 사용 안 함 ===========
app.post("/getFile", (req, res) => {
  //
  const { cidPath, fileOriginalName } = req.body;

  const request = http.get(cidPath, (response) => {
    //
    const newFilePath = `./${fileOriginalName}`;
    const newFile = fs.createWriteStream(newFilePath);
    response.pipe(newFile);

    fs.createReadStream(fileOriginalName).pipe(res);
  });

  // const request = http.get(cidPath, (response) => response.pipe(res));
});
