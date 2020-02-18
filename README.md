# vue-upload-bigfile
关于大文件上传的学习

关于fileReaderSync的readAsArrayBuffer()，它是有一个大小限制的，因此需要先切片再读取，再合并，我没改。

涉及到了原生xhr的创建发送，暂停、worker等