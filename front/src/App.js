import "./App.css";
import axios from "axios";
import { useState, useRef } from "react";

const createFormData = (files) => {
  //
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
  })

  return formData;
}

const saveFilesFn = async (files) => {
  //
  if (files.length === 0) {
    alert("파일 선택이 되지 않았습니다.");
    return;
  }

  const formData = createFormData(files);
  const saveFileResult = (await axios.post("http://localhost:8282/saveFiles", formData)).data;
  alert(saveFileResult);

  // for (const iterator of formData.values()) {
  //   console.log(iterator);
  // }
};

const saveIpfsFn = async (setImgs, setDocs) => {
  //
  const saveIpfsResult = (await axios.post("http://localhost:8282/saveIpfs")).data;

  if ((typeof saveIpfsResult) === "string") {
    //
    alert(saveIpfsResult);
    return;
  }
  // 온전한 파일명인지 확인
  console.log(saveIpfsResult.map((data) => data.path));

  const imgs = new Array(0);
  const docs = new Array(0);

  // 다양한 파일 타입별 처리 필요
  // 요구사항 => jpg, jpeg, gif, png, bmp, doc, docx, xlsx, xls, pdf, hwp 첨부 가능
  // const imageTypes = ["image/jpeg", "image/gif", "image/png", "image/bmp"];
  // const documentTypes = [
  //   "application/msword",
  //   "application/haansoftdocx",
  //   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  //   "application/haansoftxlsx",
  //   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  //   "application/vnd.ms-excel",
  //   "application/pdf",
  //   "application/haansofthwp",
  // ];

  const imgExtensionNames = ["jpg", "jpeg", "gif", "png", "bmp"];
  const documentExtensionNames = ["doc", "docx", "xlsx", "xls", "pdf", "hwp"];

  saveIpfsResult.forEach((data) => {
    //
    const cid = data.cid;
    const fileOriginalName = data.path;
    const extensionName = fileOriginalName.split(".")[fileOriginalName.split(".").length - 1];

    const isImage = imgExtensionNames.some((extension) => extension === extensionName);
    const isDocument = documentExtensionNames.some((extension) => extension === extensionName);

    if (isImage) {
      //
      imgs.push({ cid, fileOriginalName, extensionName });
    }

    else if (isDocument) {
      //
      docs.push({ cid, fileOriginalName, extensionName });
    }
  })

  setImgs(imgs);
  setDocs(docs);
};

const downloadFileFn = async (fileOriginalName) => {
  //
  const file = (await axios.post("http://localhost:8282/downloadFile", { fileOriginalName }, { responseType: "blob" })).data;

  if (file.size === 0) {
    //
    alert("해당 백 경로에 파일이 없습니다.");
    return;
  }
  
  const blob = new Blob([file]);
  const fileUrl = window.URL.createObjectURL(blob);
  window.URL.revokeObjectURL(blob);

  const aTag = document.createElement("a");
  aTag.download = fileOriginalName;
  aTag.href = fileUrl;
  aTag.click();
  aTag.remove();
};

const deleteBackFilesFn = async () => {
  //
  const resultMsg = (await axios.get("http://localhost:8282/deleteBackFiles")).data;
  alert(resultMsg);
}

function App() {
  //
  const file = useRef();
  const [imgs, setImgs] = useState();
  const [docs, setDocs] = useState();
  //
  return (
    <div className="App">
      <input type="file" ref={file} multiple />
      <button onClick={() => saveFilesFn(file.current.files)}>saveFiles</button>
      <button onClick={() => saveIpfsFn(setImgs, setDocs)}>saveIpfs</button>
      <button onClick={deleteBackFilesFn}>deleteBackFiles</button>
      {/* ---------- */}
      {/* 이미지 파일 */}
      {imgs && imgs.map((obj, index) => <img src={"http://localhost:9090/ipfs/" + obj.cid} key={index} alt="" />)}
      {imgs &&
        imgs.map((obj, index) => (
          <button onClick={() => downloadFileFn(obj.fileOriginalName)} key={index}>
            {`.${obj.extensionName} 파일 다운로드`}
          </button>
        ))}
      {/* -------- */}
      {/* 문서 파일 */}
      {docs &&
        docs.map((obj, index) => (
          <button onClick={() => downloadFileFn(obj.fileOriginalName)} key={index}>
            {`.${obj.extensionName} 파일 다운로드`}
          </button>
        ))}
    </div>
  );
}

export default App;
