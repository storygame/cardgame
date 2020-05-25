const Base = require("./base.js");
const Player = require("./player.js");
require('./yiRan_export.js');
let Errors = think.config("Errors");
module.exports = class extends Base {
  async __before() {
    let method = this.method.toLowerCase();
    this.header("Access-Control-Allow-Origin", this.header("origin") || "*");
    this.header("Access-Control-Allow-Headers", "x-requested-with");
    this.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
    this.header("Access-Control-Allow-Credentials", true);
    if (method === "options") {
      this.end();
      return;
    }
  }
  async selectResourceAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await Player.login(username, password);
    let NowUser;
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log("User <" + NowUser["username"] + "> request resource name list.");
    let resource = this.model("i18n");
    let res = await resource.select()
    if (res) {
      return this.success(res);
    } else {
      return this.fail(1004, Error['1004']);
    }
  }
  //TEST:添加i18n资源对应名称
  async addResourceNameAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await Player.login(username, password);
    let NowUser;
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    let resource = this.model("i18n");
    let name_zh = postdata["name_zh"];
    let name_en = postdata["name_en"];

    let res = await resource.add({
      id: null,
      name_zh: name_zh,
      name_en: name_en
    });
    if (res) {
      return this.success(res);
    } else {
      return this.fail(1004, Error['1004']);
    }
  }
  //TEST:修改i18n资源对应名称
  async editResourceNameAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    // console.log(username);
    // console.log(password);
    let userInfo = await Player.login(username, password);

    let NowUser;
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    let resource = this.model("i18n");
    let name_zh = postdata["name_zh"];
    let name_en = postdata["name_en"];
    let id = postdata["id"];
    // console.log(name_zh);
    // console.log(name_en);
    // console.log(id);
    let res = await resource.where({
      id: id
    }).update({
      name_zh: name_zh,
      name_en: name_en
    });
    if (res) {
      return this.success(res);
    } else {
      return this.fail(1004, Error['1004']);
    }
  }
}