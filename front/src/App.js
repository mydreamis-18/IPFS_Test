import "./App.css";
import axios from "axios";
import { useState, useRef } from "react";

const ipfsFn = async (files, setImgs, setDocs) => {
  //
  if (files.length === 0) {
    alert("파일 선택이 되지 않았습니다.");
    return;
  }

  const fileTypes = new Array(0);
  const formData = new FormData();

  Array.from({ length: files.length }, (v, i) => i).forEach((i) => {
    //
    // 파일명이 한글일 경우에 깨지는 현상을 방지하고자 인코딩 하여 전송
    const { type, size, lastModified, lastModifiedDate, webkitRelativePath } = files[i];

    const options = {
      type,
      size,
      lastModified,
      lastModifiedDate,
      webkitRelativePath,
    };
    const fileName = encodeURIComponent(files[i].name);

    const file = new File([files[i]], fileName, options);
    formData.append("files", file);
    fileTypes.push(type);
  });

  // for (const iterator of formData.values()) {
  //   console.log(iterator);
  // }

  const filesData = (await axios.post("http://localhost:8282", formData)).data;

  if (typeof filesData === "string") {
    //
    alert(filesData);
    return;
  }

  // 온전한 파일명인지 확인
  console.log(filesData.map((data) => data.path));
  console.log(fileTypes);

  const imgs = new Array(0);
  const docs = new Array(0);

  filesData.forEach((file, idx) => {
    //
    // 다양한 파일 타입별 처리 필요 => fileTypes[idx]
    // 요구사항 => jpg, jpeg, gif, png, bmp, doc, docx, xlsx, xls, pdf, hwp 첨부 가능
    const imageTypes = ["image/jpeg", "image/gif", "image/png", "image/bmp"];
    const documentTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
      "application/haansofthwp",
    ];

    const isImage = imageTypes.some((type) => type === fileTypes[idx]);
    const isDocument = documentTypes.some((type) => type === fileTypes[idx]);

    const path = "http://localhost:9090/ipfs/" + file.cid["/"];

    const fileOriginalName = filesData[idx].path;
    const extentionName = fileOriginalName.split(".")[fileOriginalName.split(".").length - 1];

    if (isImage) {
      imgs.push({ path, extentionName });
    }

    if (isDocument) {
      docs.push({ path, extentionName });
    }
  });

  setImgs(imgs);
  setDocs(docs);
};

function App() {
  //
  const file = useRef();
  const [imgs, setImgs] = useState();
  const [docs, setDocs] = useState();
  //
  return (
    <div className="App">
      <input type="file" ref={file} multiple />
      <button onClick={() => ipfsFn(file.current.files, setImgs, setDocs)}>ipfs</button>
      {/* ---------- */}
      {/* 이미지 파일 */}
      {imgs && imgs.map((path, index) => <img src={path} key={index} alt="" />)}
      {imgs &&
        imgs.map((obj, index) => (
          <button onClick={() => window.open(obj.path)} key={index}>
            {`.${obj.extentionName} 파일 다운로드`}
          </button>
        ))}
      {/* -------- */}
      {/* 문서 파일 */}
      {docs &&
        docs.map((obj, index) => (
          <button onClick={() => window.open(obj.path)} key={index}>
            {`.${obj.extentionName} 파일 다운로드`}
          </button>
        ))}
      {/* {docs &&
        docs.map((path, index) => (
          <a href={path} key={index}>
            {"excel 파일" + (index + 1) + " 다운로드"}
          </a>
        ))} */}
    </div>
  );
}

export default App;
