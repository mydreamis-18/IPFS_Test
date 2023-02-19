import "./App.css";
import axios from "axios";
import { useState, useRef } from "react";

const backAxios = axios.create({
  //
  // 요청할 백 서버 주소 (여기서의 로컬 호스트는 홈페이지 이용자의 PC IP 주소)
  // baseURL: "http://43.201.35.130:8282",
  baseURL: "http://localhost:8282",
});

const createFormData = (files) => {
  //
  const formData = new FormData();

  Array.from({ length: files.length }, (v, i) => i).forEach((i) => {
    //
    // 파일명이 한글일 경우에 깨지는 현상을 방지하고자 인코딩 하여 전송
    const { type, size, lastModified, lastModifiedDate, webkitRelativePath } =
      files[i];

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
    // formData.append("files", "test");
  });

  return formData;
};

const saveFilesFn = async (files) => {
  //
  if (files.length === 0) {
    alert("파일 선택이 되지 않았습니다.");
    return;
  }

  const formData = createFormData(files);
  const result = (await backAxios.post("saveFiles", formData)).data;
  alert(result.msg);

  // for (const iterator of formData.values()) {
  //   console.log(iterator);
  // }
};

const saveIpfsFn = async (setImgs, setButtons) => {
  //
  const result = (await backAxios.post("saveIpfs")).data;

  if (result.msg !== undefined) {
    //
    alert(result.msg);
    return;
  }

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

  const { fileOriginalNames, ipfsPaths, ipfsResult } = result.data;

  const imgExtensionNames = ["jpg", "jpeg", "gif", "png", "bmp"];
  const documentExtensionNames = ["doc", "docx", "xlsx", "xls", "pdf", "hwp"];

  const imgs = new Array(0);
  const buttons = new Array(0);

  ipfsPaths.forEach((ipfsPath, index) => {
    //
    // cid 객체
    const cid = ipfsResult[index].cid["/"];

    const fileOriginalName = fileOriginalNames[index];

    const splitedFileName = fileOriginalName.split(".");
    const extensionName = splitedFileName[splitedFileName.length - 1];

    const isImage = imgExtensionNames.some(
      (extension) => extension === extensionName
    );

    if (isImage) {
      //
      imgs.push({ fileOriginalName, ipfsPath, cid });
    }

    buttons.push({ fileOriginalName, ipfsPath, cid });
  });

  // 이미지 미리보기
  setImgs(imgs);

  // 파일 다운로드 가능한 버튼
  setButtons(buttons);
};

const sendBufferTestFn = async () => {
  //
  const result = (await backAxios.post("sendBufferTest")).data;
  console.log(result);
}

const downloadIpfsFn = async (fileOriginalName, ipfsPath, cid) => {
  //
  const result = (
    await backAxios.post(
      "downloadIpfs",
      { fileOriginalName, cid },
      { responseType: "blob" }
    )
  ).data;

  console.log(result);

  const aTag = document.createElement("a");

  // blob 객체로 생성하지 않으면 download 속성이 적용되지 않음
  const blob = new Blob([result]);

  aTag.href = window.URL.createObjectURL(blob);
  aTag.download = fileOriginalName;
  window.URL.revokeObjectURL(blob);

  aTag.click();
  aTag.remove();
};

const downloadBackFileFn = async (fileOriginalName) => {
  //
  const encodedFileName = encodeURIComponent(fileOriginalName);

  const result = (
    await backAxios.post(
      "downloadBackFile",
      { encodedFileName },
      { responseType: "blob" }
    )
  ).data;

  if (result.size === 0) {
    //
    alert("해당 백 경로에 파일이 없습니다.");
    return;
  }

  const aTag = document.createElement("a");

  const blob = new Blob([result]);

  aTag.href = window.URL.createObjectURL(blob);
  aTag.download = fileOriginalName;
  window.URL.revokeObjectURL(blob);

  aTag.click();
  aTag.remove();
};

const deleteBackFilesFn = async () => {
  //
  const result = (await backAxios.get("deleteBackFiles")).data;
  alert(result.msg);
};

function App() {
  //
  const file = useRef();
  const [imgs, setImgs] = useState();
  const [buttons, setButtons] = useState();
  //
  return (
    <div className="App">
      <input type="file" ref={file} multiple />
      <button onClick={() => saveFilesFn(file.current.files)}>saveFiles</button>
      <button onClick={() => saveIpfsFn(setImgs, setButtons)}>saveIpfs</button>
      <button onClick={deleteBackFilesFn}>deleteBackFiles</button>
      <button onClick={sendBufferTestFn}>sendBufferTest</button>
      {/* ---------- */}
      {/* 이미지 파일 */}
      {imgs &&
        imgs.map((obj, index) => <img src={obj.ipfsPath} key={index} alt="" />)}
      {/* ---------------- */}
      {/* 파일 다운로드 버튼 */}
      {buttons &&
        buttons.map((obj, index) => (
          <button
            // onClick={() =>
            //   downloadIpfsFn(obj.fileOriginalName, obj.ipfsPath, obj.cid)
            // }
            onClick={() => downloadBackFileFn(obj.fileOriginalName)}
            key={index}
          >
            {`${obj.fileOriginalName} 파일 다운로드`}
          </button>
        ))}
    </div>
  );
}

export default App;
