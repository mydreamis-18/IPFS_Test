import './App.css';
import axios from "axios";
import { useState, useRef } from "react";

const ipfsFn = async (files, setImgs) => {
  //
  if (files.length === 0) {
    alert("파일 선택이 되지 않았습니다.");
    return;
  }

  const formData = new FormData();
  Array.from({ length: files.length }, (v, i) => i).forEach((i) => {
    //
    // 파일명이 한글일 경우에 깨지는 현상을 방지하고자 인코딩 하여 전송
    const { type, size, lastModified, lastModifiedDate, webkitRelativePath } = files[0];
    const options = { type, size, lastModified, lastModifiedDate, webkitRelativePath};
    const fileName = encodeURIComponent(files[i].name);
    
    const file = new File([files[i]], fileName, options);
    formData.append(`files`, file);
    console.log(file);
  });

  // for (const iterator of formData.values()) {
  //   console.log(iterator);
  // }

  const imgsData = (await axios.post("http://localhost:8282", formData)).data;

  if ((typeof imgsData) === "string") {
    //
    alert(imgsData);
    return;
  }

  // 온전한 파일명 확인 가능
  console.log(imgsData.map((data) => decodeURIComponent(data.path)));

  const imgPaths = imgsData.map((data) => "http://localhost:9090/ipfs/" + data.cid["/"]);
  setImgs(imgPaths);
}

function App() {
  //
  const file = useRef();
  const [imgs, setImgs] = useState();
  //
  return (
    <div className="App">
      <input type="file" ref={file} multiple />
      <button onClick={() => ipfsFn(file.current.files, setImgs)}>ipfs</button>
      {/*  */}
      {imgs && imgs.map((path, index) => <img src={path} key={index} alt="" />)}
    </div>
  );
}

export default App;
