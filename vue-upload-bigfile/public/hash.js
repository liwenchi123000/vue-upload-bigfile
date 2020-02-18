self.importScripts('/spark-md5.min.js');

self.onmessage = event => {
    const file = event.data;
    const spark = new self.SparkMD5.ArrayBuffer();
    const reader = new FileReaderSync();
    console.log(1);
    
    const arrayBuffer = reader.readAsArrayBuffer(file);
    console.log(2);
    spark.append(arrayBuffer);
    console.log(3);
    self.postMessage({
        hash: spark.end()
    })
    self.close();
    // reader.onload = e => {
    //     spark.append(e.target.result);
    //     self.postMessage({
    //         result: spark.end()
    //     })
    //     self.close();
    // }
    // let count = 0;
    // const fileChunksList = event.data;
    // const spark = new self.SparkMD5.ArrayBuffer();
    // const loadNext = index => {
    //     if (count === fileChunksList.length) {
    //         self.postMessage({
    //             percent: 100,
    //             result: spark.end()
    //         })
    //         self.close();
    //     } else {
    //         self.postMessage({
    //             percent: count * 100 / fileChunksList.length,
    //             result: null
    //         })
    //     }
    //     const reader = new FileReader();
    //     reader.readAsArrayBuffer(fileChunksList[index]);
    //     reader.onload = e => {
    //         spark.append(e.target.result);
    //         loadNext(++count);
    //     }
    // }
    // loadNext(count);
}