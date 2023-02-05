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
  const ipfsClient = await createIpfsClientFn();

  ipfs = ipfsClient.create({
    host: "127.0.0.1",
    protocol: "http",
    port: "5002",
  });

  globSource = ipfsClient.globSource;
})();

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

app.listen(PORT, () => console.log("back server start..."));

// ipfs에 저장할 파일 이름
let fileNames = new Array(0);

app.post("/saveFiles", multer().array("files"), async (req, res) => {
  //
  req.files.map((file) => {
    //
    const fileName = decodeURIComponent(file.originalname);
    fs.writeFileSync("reportFiles/" + fileName, file.buffer);
    fileNames.push(fileName);
  });

  res.send("모든 첨부 파일 저장 완료!");
});

app.post("/saveIpfs", async (req, res) => {
  //
  if (ipfs === undefined) {
    res.send("ipfs 모듈이 import 중이니 잠시 후 다시 시도해주세요.");
    return;
  }

  const ipfsPaths = new Array(0);
  const ipfsResult = new Array(0);
  const fileBuffers = new Array(0);

  // 파일이 저장된 백 폴더 경로
  const backFolderPath = "./reportFiles";

  try {
    //
    await Promise.all(
      fileNames.map(async (name) => {
        //
        // 두 번재 인자인 파일 이름에 [] 기호가 포함될 경우 오류가 발생하기 때문에 첫 번째 인자에 파일 이름까지 기재
        for await (const iterator of ipfs.addAll(globSource(path.join(backFolderPath, name), "**/*"))) {
          //
          // ipfs 저장 { path, cid, size, mode }
          ipfsResult.push(iterator);

          // 블록체인에 저장할 ipfs 경로
          const cidPath = "http://127.0.0.1:9090/ipfs/" + iterator.cid;
          ipfsPaths.push(cidPath);
        }

        // 백에 저장된 파일의 버퍼 값
        const buffer = fs.readFileSync(backFolderPath + "/" + name);
        fileBuffers.push(buffer);
      })
    );
  } catch (error) {
    //
    res.send("저장된 파일의 경로와 jsipfs daemon의 실행 여부를 다시 한 번 확인해주세요.");
    return;
  }
  console.log(ipfsPaths);
  console.log(ipfsResult);
  console.log(fileBuffers);

  res.send(ipfsResult);
})

app.post("/downloadFile", (req, res) => {
  //
  const { fileOriginalName } = req.body;

  const backFolderPath = "./reportFiles";
  const filePath = path.join(__dirname, backFolderPath, fileOriginalName);

  // 해당 백 경로에 파일이 없을 경우
  const isMissingFile = !(fs.existsSync(filePath));
  if (isMissingFile) {
    //
    // blob 타입으로 전송
    res.send();
    return;
  }

  const fileName = encodeURIComponent(fileOriginalName);
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
  res.sendFile(filePath);

  // res.download(filePath, fileOriginalName);
})

app.get("/deleteBackFiles", (req, res) => {
  //
  // 삭제할 파일들 경로
  const filePaths = ["reportFiles/문서1.docx"];

  filePaths.forEach((path) => {
    //
    try {
      //
      fs.unlinkSync(path);

    } catch (err) {
      //
      console.log(err);
    }
  })
  res.send("파일 삭제 완료!");
})

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
    res.send("ipfs 모듈 import 중이니 잠시 후 다시 시도해주세요.");
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
        const ipfsReuslt = await ipfs.add({ path: decodeURIComponent(file.originalname), content: file.buffer })
        imgsData.push(ipfsReuslt);
      })
    );
  } catch (error) {
    //
    res.send("ipfs daemon이 실행 중인지 확인해주세요.");
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
  res.send(imgsData);
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
