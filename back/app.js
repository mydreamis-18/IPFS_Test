const express = require("express");
const multer = require("multer");
const cors = require("cors");
const app = express();
const PORT = 8282;

let ipfs;
let globSource;

// 비동기 방식인 ES 모듈을 커먼 JS로 가져오기
const ipfsClientFn = async () => {
  //
  const { create, globSource } = await import("ipfs-http-client");
  return { create, globSource };
};

(async () => {
  //
  const ipfsClent = await ipfsClientFn();

  ipfs = ipfsClent.create({
    host: "localhost",
    port: "5002",
    protocol: "http",
  });

  globSource = ipfsClent.globSource;
})();

app.use(cors({ origin: "http://localhost:3000" }));

app.listen(PORT, () => console.log("back server start..."));

app.post("/", multer().array("files"), async (req, res) => {
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
        imgsData.push(
          await ipfs.add({
            path: decodeURIComponent(file.originalname),
            content: file.buffer,
          })
        );
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
