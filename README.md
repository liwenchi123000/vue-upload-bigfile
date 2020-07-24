# vue-upload-bigfile

此项目是关于大文件上传的学习，前端部分使用了vue，后端使用了我熟悉的express。

关于`fileReaderSync`的`readAsArrayBuffer()`，它是有一个大小限制的，因此需要先切片再读取，再合并，我没改。

涉及到的内容有:

前端部分

1. 从文件到Blob的转换
2. 通过对文件对象`Blob.slice()`，从而进行切片处理，利用`Promise.all()`并发上传
3. webWorker的使用，利用webWorker计算文件hash
4. Formdata对象的使用
5. 原生ajax的使用，使用xhr对象发送formdata，以及取消一个xhr
6. xhr对onProgress事件的监听实现上传进度显示
7. 实现断点续传，原理是浏览器在上传之前请求一次文件已上传分片的hash

后端部分

1. 涉及到了跨域问题，本次利用headers解决，而不是cors。当请求不包含数据的时候，直接在对应的请求函数后面设置headers即可，当请求中包含数据或json时需要特殊处理options，我自己的理解就是在正式发送数据之前，浏览器会先发一个options请求来探探口风，如果你只处理了get/post请求的res.header，依然会显示资源无法跨域。
2. fs模块的使用，我发现fs-extra在用的时候小毛病还是很多的，有的同步函数居然根本就不起作用，只能用async/await + 异步函数代替。
3. 利用pipeStream合并文件切片
