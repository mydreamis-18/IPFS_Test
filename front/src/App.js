import './App.css';
import axios from "axios";
import { useState, useRef } from "react";

const ipfsFn = async (files, setImgs, setJsonData) => {
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
    const { type, size, lastModified, lastModifiedDate, webkitRelativePath } = files[0];
    const options = { type, size, lastModified, lastModifiedDate, webkitRelativePath };
    const fileName = encodeURIComponent(files[i].name);

    const file = new File([files[i]], fileName, options);
    formData.append(`files`, file);
    fileTypes.push(type);
  });

  // for (const iterator of formData.values()) {
  //   console.log(iterator);
  // }

  const filesData = (await axios.post("http://localhost:8282", formData)).data;

  if ((typeof filesData) === "string") {
    //
    alert(filesData);
    return;
  }

  // 온전한 파일명 확인 가능
  console.log(filesData.map((data) => decodeURIComponent(data.path)));

  console.log(fileTypes);

  filesData.forEach((file, idx) => {
    //
    const imgs = new Array(0);
    const jsonData = new Array(0);

    // 다양한 파일 타입별 처리 필요
    switch (fileTypes[idx]) {
      //
      case "image/jpeg":
        imgs.push("http://localhost:9090/ipfs/" + file.cid["/"]);
        break;

      case "application/haansoftxlsx":
        jsonData.push("http://localhost:9090/ipfs/" + file.cid["/"]);
        break;

      default:
        break;
    }

    setImgs(imgs);
    setJsonData(jsonData);
    console.log(imgs, jsonData);
  })
}

function App() {
  //
  const file = useRef();
  const [imgs, setImgs] = useState();
  const [jsonData, setJsonData] = useState();
  //
  return (
    <div className="App">
      <input type="file" ref={file} multiple />
      <button onClick={() => ipfsFn(file.current.files, setImgs, setJsonData)}>ipfs</button>
      {/* ------------------------- */}
      {/* 이미지 파일일 경우 보여주기 */}
      {imgs && imgs.map((path, index) => <img src={path} key={index} alt="" />)}
      {/* -------------------------------- */}
      {/* 엑셀 파일일 경우 다운로드 버튼 생성 */}
      {jsonData && jsonData.map((path, index) => <button onClick={() => window.open(path)}>{"excel 파일" + (index + 1) + " 다운로드"}</button>)}
    </div>
  );
}

export default App;
