// AWS Ubuntu에서의 ipfs 구축 방법

// (1) sudo npm i -g ipfs => 설치
// (2) jsipfs daemon => 실행 후 종료
// 실행 안 될 경우 노드 버전 업그레이드

// (3) cd home/ubuntu/.jsipfs
// 혹은 sudo su => cd .. => root/.jsipfs

// (4) vi config => 파일 수정 i
// Address.Swarm : 4003번 요소 삭제 해도 됨
// Address.API : 127.0.0.1 => AWS_PRIVATE_IP 변경
// Address.Gateway : 127.0.0.1 => AWS_PRIVATE_IP 변경
// Address.RPC : 127.0.0.1 => AWS_PRIVATE_IP 변경
// esc => :wq! => 저장 후 종료

// (5) rm -rf repo.lock => 파일 삭제

// (6) jsipfs daemon => 실행 시 변경된 IP 주소 확인

// (7) AWS 인스턴스 보안 그룹의 인바운드 규칙 추가
// 프론트 포트 추가 (3000) => ${AWS_PUBLIC_IP:프론트 포트}로 페이지 접속 가능
// 백엔드 포트 추가 (8282) => AXIOS 통신 가능
// 9090 포트 추가 => IPFS 파일 접근 주소 접속 가능

// (8) AWS_PUBLIC_IP => 프론트 AXIOS 요청 주소, 백엔드 CORS ORIGIN 주소, IPFS 파일 접근 주소로 사용
// (9) AWS_PRIVATE_IP => JSIPFS DAEMON 노드의 IP 주소, IPFS-HTTP-CLIENT 연결 주소로 사용

const AWS_PATH =
  "http://ec2-43-201-35-130.ap-northeast-2.compute.amazonaws.com";
const AWS_PRIVATE_IP = "172.31.0.61";
const AWS_PUBLIC_IP = "43.201.35.130";

// 127.0.0.1 값만 사용 시 cors 에러 발생
const LOCALHOST1 = "localhost";
const LOCALHOST2 = "127.0.0.1";
// let LOCALHOST2;

const BACK_FILE_FOLDER_NAME = "multerFiles";
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const http = require("http");
const BACK_MAIN_PORT = 8282;
const BACK_SUB_PORT = 8888;
const fs = require("fs");
const app = express();

// const test = require("ipfs-http-client")
// Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in C:\Users\tkekd\OneDrive\바탕 화면\ipfs_Test\back\node_modules\ipfs-http-client\package.json

// ipfs-http-client 모듈의 버전에 따라 Common JS 방식의 import도 가능하지만 이왕이면 최신 버전을 사용하고 싶었음
// 해당 모듈의 package.json 파일에서 모듈 방식에 대한 내용 확인 가능 => "type": "module"

// 비동기 방식인 ES 모듈을 커먼 JS로 가져오기
let ipfs, globSource;

// 구조 분해 할당을 사용하면 혹시 보다 효율적이지 않을까 추측하여 별도의 함수로 분리함
// nodejs에서는 싱글톤 패턴을 구현하지 않아도 된다고 함
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
    host: LOCALHOST2 || AWS_PRIVATE_IP,
    protocol: "http",
    port: "5002",
  });

  globSource = ipfsClient.globSource;
})();

// buffer 전송 크기 제한 (PayloadTooLargeError : reqest entity too large)
app.use(express.json({ limit: "50mb" }));

app.use(cors({ origin: LOCALHOST2 ? [`http://${LOCALHOST1}:3000`] : [`http://${AWS_PUBLIC_IP}:3000`, `${AWS_PATH}:3000`] }));

app.listen(BACK_MAIN_PORT, () => console.log("back main server start..."));
app.listen(BACK_SUB_PORT, () => console.log("back sub server start..."));

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
  // 폼데이터의 파일 객체 데이터
  console.log(req.files)

  // 폼데이터의 다른 데이터
  // console.log(req.body.files)

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
    // 프로젝트 내에서 데이터를 해시하는 과정에서 배열의 순서 또한 중요하기 때문에
    // 비동기적으로 처리되어 배열의 순서가 달라지면 안 됨
    // await Promise.all(
    //   filePaths.map(async (filePath) => {

    for (const filePath of filePaths) {
      //
      // 파일 패턴에 대한 두 번재 인자 값에 [] 기호가 포함된 파일명이 담길 경우 파일을 찾지 못하기 때문에
      // 첫 번째 인자 값에 파일명이 포함된 해당 파일까지의 디렉토리 주소를 기재함
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
        const cidPath = `http://${LOCALHOST2 || AWS_PUBLIC_IP}:9090/ipfs/${iterator.cid}`;
        ipfsPaths.push(cidPath);
      }

      // 백에 저장된 파일의 버퍼 값
      const buffer = fs.readFileSync(filePath);
      fileBuffers.push(buffer);
    }
    // })
    // );
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

// 프로젝트 내에서 백엔드 서버에서 패브릭 네트워크 서버로 버퍼 값을 전송해야 했기 때문에 버퍼 사이즈에 대한 통신 가능 여부 테스트
app.post("/sendBufferTest", async (req, res) => {
  //
  const buffers = new Array(0);

  const fileNames = fs.readdirSync(BACK_FILE_FOLDER_NAME);
  console.log(fileNames);

  fileNames.map((fileName) => {
    //
    const buffer = fs.readFileSync(path.join(BACK_FILE_FOLDER_NAME, fileName));
    buffers.push(buffer);
  })

  const result = (await axios.post(`http://${LOCALHOST2}:8888/receiveBuffer`, { buffers })).data;
  res.send(result);
})

app.post("/receiveBuffer", async (req, res) => {
  //
  const { buffers } = req.body;

  buffers.map((buffer) => console.log(buffer.data));

  res.send({ success: true });
})

app.post("/downloadIpfs", async (req, res) => {
  //
  const { fileOriginalName, cid } = req.body;

  const iwantbuffers = new Array(0);

  // 파일이 다양한 노드에 저장되는지 배열에 담지 않으면 이미지 파일의 일부분만 온전할 수 있음
  for await (const chunk of ipfs.cat(cid)) {
    console.info(chunk);
    iwantbuffers.push(chunk);
  }

  // 버퍼 값으로 백엔드에 파일 저장 가능
  // fs.writeFileSync(path.join("ipfsFiles", fileOriginalName), iwantbuffer);

  res.send(Buffer.concat(iwantbuffers));
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

  // res.sendFile(fil ePath);
  res.download(filePath);
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
