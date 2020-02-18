const fse = require('fs-extra');
const fs = require('fs');
const path = require('path');

const mergeFileChunks = async (fileChunksDirPath, fileFinalPath, size) => {
    const chunks = await fse.readdir(fileChunksDirPath);
    chunks.sort((a, b) => a.split('-')[1] - b.split('-')[1]);
    await Promise.all(
        chunks.map((chunk, chunkIndex) => {
            return pipeStream(
                chunkIndex,
                path.resolve(fileChunksDirPath, chunk),
                fse.createWriteStream(fileFinalPath, {
                    start: chunkIndex * size,
                    end: (chunkIndex + 1) * size
                })
            )
        })
    )
    // 合并成功
    fse.rmdirSync(fileChunksDirPath);
}

const pipeStream = (i, eachChunkPath, writeStream) => {
    return new Promise(resolve => {
        const readStream = fse.createReadStream(eachChunkPath);
        readStream.on("end", () => {
            fse.unlinkSync(eachChunkPath);
            resolve(i);
        })
        readStream.pipe(writeStream);
    })
}

module.exports = mergeFileChunks;