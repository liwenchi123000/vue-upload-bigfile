// node模块
const path = require('path');

// 外部npm包
const fse = require('fs-extra');
const express = require('express');
const multiparty = require('multiparty');
const app = express();

// 自定义模块
const mergeFileChunks = require('./mergeFileChunks');

// 自定义常量
const TEMP_CHUNKS_SAVE_DIR = './tempdir';
const FINAL_FILE_SAVE_DIR = './target';

/**
 * 浏览器在发送json数据时会先发一个options请求来确保服务器可以相应
 * 因此，即使你在post/get方法里设置了跨域还是不能成功
 */

app.options('/', function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    res.setHeader('Access-Control-Allow-Headers', "*");
    res.status(200).end('这是一个root options');
    return;
})
app.options('/merge', function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    res.setHeader('Access-Control-Allow-Headers', "*");
    res.status(200).end('这是一个merge options');
    return;
})

app.options('/verify', function (req, res) {
    res.set({
        'Access-Control-Allow-Origin': "*",
        'Access-Control-Allow-Headers': "*",
    })
    res.status(200).end('这是一个verify options');
    return;
})

app.post('/', function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    res.setHeader('Access-Control-Allow-Headers', "*");
    const form = new multiparty.Form();
    form.parse(req, function(err, fields, files) {
        if (err) {
            console.error(err);
            res.status(500).end('服务器故障');
            return;
        }
        const [chunk] = files.chunk;
        const [hash] = fields.hash;
        const [originFileHash] = fields.originFileHash
        const [fileName] = fields.fileName;
        const finalFileSaveDir = path.resolve(
            __dirname,
            FINAL_FILE_SAVE_DIR,
            `./${originFileHash}${extractExt(fileName)}`
        )
        if (fse.existsSync(finalFileSaveDir) === true) {
            res.end('file exist');
            return;
        }
        const tempChunksSaveDir = path.resolve(
            __dirname,
            TEMP_CHUNKS_SAVE_DIR,
            originFileHash,
        )

        if (!fse.existsSync(tempChunksSaveDir)) {
            fse.mkdirsSync(tempChunksSaveDir)
        }
        try {
            fse.moveSync(chunk.path, path.resolve(tempChunksSaveDir, hash));
            console.log(`已创建${hash} chunk`);
            
        } catch {
            console.log('已存在');
        }
        res.status(200).end(`recieve chunk ${hash.split('-')[1]} successed`);
    })
})

/**
 * 接收执行合并请求
 */
app.post('/merge', async function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', "*");
    res.setHeader('Access-Control-Allow-Headers', "*");
    const fileName = req.query.filename;
    const fileHash = req.query.filehash;
    const size = req.query.size;
    const ext = extractExt(fileName);
    const filePath = path.resolve(__dirname, FINAL_FILE_SAVE_DIR, `${fileHash}${ext}`);
    await mergeFileChunk(filePath, fileHash, size);
    res.end(
        JSON.stringify({
            code: 0,
            message: "file merged success"
        })
    );
})


/**
 * 接收执行验证请求
 * 如果在目标文件夹发现hash相同的文件，则视为不应该再上传
 * 否则上传，并且还要判断是否有已上传chunk片段
 */
app.post('/verify', async function (req, res) {
    res.set({
        'Access-Control-Allow-Origin': "*",
        'Access-Control-Allow-Headers': "*",
    })
    const result = await resolvePostData(req);
    const { fileName, fileContentHash } = JSON.parse(result);
    const ext = extractExt(fileName);
    const filePath = path.resolve(__dirname, './target/' , `${fileContentHash}${ext}`);
    if (fse.existsSync(filePath)) {
        res.end(JSON.stringify({
            shouldUpload: false
        }))
    } else {
        res.end(JSON.stringify({
            shouldUpload: true,
            uploadedList: await createUploadedList(fileContentHash)
        }))
    }
})



app.listen(3000, function () {
    console.log('3000...');
})

function createUploadedList(fileContentHash) {
    const chunkSaveDir = path.resolve(__dirname, TEMP_CHUNKS_SAVE_DIR, fileContentHash);
    return fse.existsSync(chunkSaveDir) ? fse.readdirSync(chunkSaveDir) : [];
}

function pipeStream(chunkFilePath, writeStream) {
    return new Promise(resolve => {
        // console.log('正在准备写入流', chunkFilePath);
        const readStream = fse.createReadStream(chunkFilePath);
        readStream.on("close", () => {
            fse.unlinkSync(chunkFilePath);
            resolve();
        })
        readStream.pipe(writeStream);
    })
}

async function mergeFileChunk(filePath, fileHash, size) {
    console.log('正在合并文件');
    
    const chunkDir = path.resolve(__dirname, TEMP_CHUNKS_SAVE_DIR, fileHash);
    const chunkPaths = fse.readdirSync(chunkDir);
    if (chunkPaths.length === 0) return;
    chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
    await Promise.all(
        chunkPaths.map((chunkPath, index) => {
            return pipeStream(
                path.resolve(chunkDir, chunkPath),
                fse.createWriteStream(filePath, {
                    start: index * size,
                    end: (index + 1) * size
                })
            )
        })
    )
    fse.rmdirSync(chunkDir);
}


function resolvePostData (request) {
    return new Promise(resolve => {
        let chunk = "";
        request.on("data", data => {
            chunk += data;
        })
        request.on("end", () => {
            resolve(chunk)
        })
    })
}

function extractExt (fileName) {
    return fileName.slice(fileName.lastIndexOf('.'), fileName.length);
}

// https://stackoverflow.com/questions/32500073/request-header-field-access-control-allow-headers-is-not-allowed-by-itself-in-pr
// express-cache-controller