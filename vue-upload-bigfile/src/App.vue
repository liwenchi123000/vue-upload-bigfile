<template>
  <div id="app">
    <div>
      <section>
        <input type="file" @change="handleFileChange" />
        <el-button @click="handleFileUpload">upload</el-button>
        <el-button @click="handlePause">暂停</el-button>
        <el-button @click="handleRestart">继续</el-button>
      </section>
      <section>
        <h1>计算文件Hash</h1>
      </section>
      <section>
        <div>上传进度</div>
        <el-progress :percentage="calculateTotalPercentage"> 

        </el-progress>
      </section>
      <section>
        <el-table :data="data" v-loading="loading">
          <el-table-column prop="hash" label="切片hash" align="center">
          </el-table-column>
          <el-table-column label="大小(KB)" align="center" width="120">
            <template v-slot="{row}">
              {{row.size | transformByte}}
            </template>
          </el-table-column>
          <el-table-column label="进度" align="center">
            <template v-slot="{row}">
              <el-progress :percentage="row.percentage" colot="#000">
              </el-progress>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script>
const CHUNK_SIZE = 500 * 1024 * 1024;

const STATUS = {
  pause: 'pause',
  uploading: 'uploading',
  wait: 'wait'
}
export default {
  name: "App",
  filters: {
    transformByte (val) {
      return Number((val/1024).toFixed(0));
    }
  },
  computed: {
    calculateTotalPercentage () {
      if (!this.container.file || !this.data.length) return 0;
      const loaded = this.data
        .map(item => item.size * item.percentage)
        .reduce((acc, cur) => acc + cur)
      return parseInt((loaded/this.container.file.size).toFixed(2));
    }
  },
  data: function() {
    return {
      loading: null,
      container: {
        file: null,
        hash: null,
        worker: null
      },
      data: [],
      requestsList: [], // xhr
      totalUploadPercentage: 0,
      status: STATUS.wait
    };
  },
  methods: {
    handlePause () {
      this.status = STATUS.pause
      this.resetData();
    },
    resetData () {
      this.requestsList.forEach(xhr => xhr ? xhr.abort() : null);
      this.requestsList = [];
      if (this.container.worker) {
        // hash计算中
        this.container.worker.onmessage = null
      }
    },
    async handleRestart () {
      this.status = STATUS.uploading;
      const { uploadedList } = await this.verifyUpload(
        this.container.file.name,
        this.container.hash
      )
      await this.uploadChunks(uploadedList);
    },
    /**
     * 计算文件的hash
     */
    async calculateHash(fileChunksList) {
      return new Promise(resolve => {
        // Worker Api
        this.container.worker = new Worker("/hash.js");
        // this.container.worker.postMessage(fileChunksList);
        this.container.worker.postMessage(this.container.file);
        this.container.worker.onmessage = event => {
          const hash = event.data.hash;
          if (hash) {
            resolve(hash);
          }
        };
      });
    },
    handleFileChange(e) {
      this.data = [];
      const [file] = e.target.files;
      if (file) {
        this.container.file = file;
      }
    },
    createFileChunksList(file, chunkSize = 1 * 1024 * 1024) {
      let fileChunksList = [];
      if (file) {
        for (let cur = 0; cur < file.size; ) {
          fileChunksList.push(file.slice(cur, cur + CHUNK_SIZE));
          cur += CHUNK_SIZE;
        }
      }
      return fileChunksList;
    },
    async handleFileUpload() {
      if (!this.container.file) return;
      const fileChunksList = this.createFileChunksList(this.container.file, CHUNK_SIZE);
      this.loading = true;
      this.container.hash = await this.calculateHash(fileChunksList);
      this.loading = false;
      const { shouldUpload, uploadedList } = await this.verifyUpload(
        this.container.file.name,
        this.container.hash
      );
      if (!shouldUpload) {
        window.alert("秒传成功！");
        this.status = STATUS.wait;
        return;
      } else {
        this.data = fileChunksList.map((chunk, index) => {
          return {
            index,
            chunk,
            size: chunk.size,
            hash: this.container.hash + "-" + index,
            originFileHash: this.container.hash,
            percentage: uploadedList.includes(index) ? 100 : 0
          };
        });
        await this.uploadChunks(fileChunksList, uploadedList);
      }
    },
    async uploadChunks(uploadedList = []) {
      console.log('本次uploadedList', uploadedList);
      console.log('现存的data', this.data);
      if (this.container.file === null) {
        alert('尚未准备文件')
        return;
      }
      const requestsList = this.data
        .filter(({hash}) => {
          return !uploadedList.includes(hash);
        })
        .map(({ chunk, hash, index }) => {
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("hash", hash);
          formData.append("fileName", this.container.file.name);
          formData.append("originFileHash", this.container.hash);
          return { formData, index };
        })
        .map(({ formData, index }) => {
          return this.request({
            url: "http://localhost:3000",
            data: formData,
            onProgress: this.createProgressHandler(this.data[index]),
            requestsList: this.requestsList
          });
        });
        if (requestsList !== 0) {
          await Promise.all(requestsList);
        }
        console.log('发出merge请求');
        if (uploadedList.length + requestsList.length === this.data.length) {
          await this.mergeRequest();
        }
    },
    async mergeRequest () {
      await this.request({
        url: `http://localhost:3000/merge?filename=${this.container.file.name}&filehash=${this.container.hash}&size=${CHUNK_SIZE}`
      })
      alert('上传成功');
      this.status = STATUS.wait;
    },
    createProgressHandler (item) {
      return e => {
        item.percentage = parseInt(String(e.loaded*100/e.total))
      }
    },
    async verifyUpload(fileName, fileContentHash) {
      const { data } = await this.request({
        url: "http://localhost:3000/verify",
        headers: {
          "Content-Type": "application/json"
        },
        data: JSON.stringify({
          fileName,
          fileContentHash
        })
      });
      return JSON.parse(data);
    },
    request({ 
      url, 
      data, 
      headers = {}, 
      method = "POST", 
      onProgress = null,
      requestsList 
    }) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = onProgress;
        xhr.open(method, url);
        Object.keys(headers).forEach(key => {
          xhr.setRequestHeader(key, headers[key]);
        });
        xhr.send(data);
        xhr.onload = e => {
          console.log('已完成一个xhr');
          console.log(e.target.response);
          
          if (requestsList) {
            // 将完成请求的req从reqList删除
            const xhrIndex = requestsList.findIndex(item => item === xhr);
            requestsList.splice(xhrIndex, 1);
          }
          resolve({
            data: e.target.response
          });
        };
        if (requestsList) {
          requestsList.push(xhr);
        }
      });
    }
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
