const Base = require("../base.js");
const uuid = require("es6-uuid");
const crypto = require("crypto");
let Errors = think.config("Errors");
module.exports = class extends Base {
  __call() {
    let method = this.http.method.toLowerCase();
    if (method === 'options') {
      this.setCorsHeader();
      this.end();
      return;
    }
    this.setCorsHeader();
    return super.__call();
  }
  setCorsHeader() {
    this.header('Access-Control-Allow-Origin', this.header('origin') || '*');
    this.header('Access-Control-Allow-Headers', 'x-requested-with');
    this.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
    this.header('Access-Control-Allow-Credentials', 'true');
  }
  async __before() {
    const userInfo = await this.session(this.ctx.ip);
    if (userInfo == undefined || userInfo === null) {
      return this.fail(1002, Errors['1002']);
    }
  }

  /**
   * [selectPlayerDataAction 获取游戏玩家数据]
   * @params {int} pageNo - 页码
   * @params {int} pageSize - 单页容量
   * @return {Promise} [database player table]
   */
  async selectPlayerDataAction() {
    let postdata = this.post();
    let pageNo = postdata['pageNo'];
    let pageSize = postdata['pageSize'];
    let player = this.model("player");
    let res = await player.page(pageNo, pageSize).select();
    return this.success(res);
  }
  /**
   * [selectPlayerCountAction 查询玩家总数量]
   * @return {Promise} [玩家数量]
   */
  async selectPlayerCountAction() {
    let player = this.model('player');
    let count = await player.count('id');
    return this.success(count);
  }
  /**
   * [setCoinsAction 设置玩家的硬币,测试用]
   * @params {int} id
   * @params {int} coin
   * @return {Promise} [是否成功]
   */
  async setCoinsAction() {
    let postdata = this.post();
    let userid = postdata["id"];
    let coins = postdata["coin"];
    let player = this.model("player");
    let userdata = await player.where({id: userid}).select();
    if (userdata.length != 1) {
      return this.fail();
    }
    await player.where({id: userid}).update({coins: parseInt(coins)});
    return this.success();
  }
  /**
   * [addExpAction 为玩家添加经验]
   * @params {int} id
   * @params {int} exp
   * @return {Promise} [是否成功]
   */
  async addExpAction() {
    let player = this.model("player");
    let postdata = this.post();
    let userid = postdata["id"];
    let exp = parseInt(postdata["exp"]);
    let data = await player.where({id: userid}).select();
    if (data.length == 0) {
      return this.fail(1009, Errors['1009']);
    }
    let oldExp = data[0]["exp"];
    let res = await player.where({id: id}).update({
      exp: (oldExp + exp)
    });
    if (!res) {
      return this.fail(1004, Errors["1004"]);
    }
    data[0]["exp"] += exp;
    return this.success({"userinfo": data[0]});
  }
  /**
   * [initializeUserAction 还原一个user的单人剧情信息,方便反复测试]
   * @params {int} id
   * @return {Promise} [是否成功]
   */
  async initializeUserAction() {
    let postdata = this.post();
    let userid = postdata["id"];
    let player = this.model("player");
    let tmp_collection = postdata["tmp_collection"];
    let single_level = postdata["single_level"];
    let tmp_level = postdata["tmp_level"];
    if (single_level == undefined) {
      single_level = "1.0";
    }
    if (tmp_level == undefined) {
      tmp_level = "1.0";
    }
    if (tmp_collection == undefined) {
      tmp_collection = "[]";
    } else if (typeof tmp_collection != "string") {
      tmp_collection = JSON.stringify(tmp_collection);
    }
    let userdata = await player.where({id: userid}).select();
    if (userdata.length != 1) {
      return this.fail();
    }
    await player.where({id: userid}).update({
      coins: 2000,
      exp: 500,
      single_level: single_level,
      tmp_level: tmp_level,
      cards_collection: "[]",
      tmp_collection: tmp_collection
    });
    return this.success();
  }
}
