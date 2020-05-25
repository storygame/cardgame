const Base = require("./base.js");
const Player = require("./player.js");
require('./yiRan_export.js');
let Errors = think.config("Errors");
const GameMode = {};
let NowUser;
const consoleSymbol = {
  "yes": "\u001b[0;32;40m[✓]\u001b[0m",
  "no": "\u001b[0;31;40m[✗]\u001b[0m",
  "info": "\u001b[1;34;40m[*]\u001b[0m"
};
module.exports = class extends Base {
  async __before() {
    let method = this.method.toLowerCase();
    this.header("Access-Control-Allow-Origin", this.header("origin") || "*");
    this.header("Access-Control-Allow-Headers", "x-requested-with");
    this.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PUT,DELETE");
    this.header('Access-Control-Allow-Credentials', true);
    if (method === "options") {
      this.end();
      return;
    }
  }
  async selectChaptersAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let userInfo = await Player.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log("User <" + NowUser["username"] + "> request Chapters data.");
    let chapter = this.model('chapter');
    let res = await chapter.select();
    return this.success(res);
  }
  async selectOneChapterAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let chapter_id = postdata["chapter_id"];
    let userInfo = await Player.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log("User <" + NowUser["username"] + "> request one chapter data(id: " + chapter_id + ").");
    let chapter = this.model('chapter');
    let res = await chapter.where({
      "id": chapter_id
    }).select();
    return this.success(res);
  }
  //TEST:更改章节信息
  async editChapterAction() {
    const Chapter = this.model('chapter');
    const postdata = this.post();
    const chapter_id = postdata["chapter_id"];
    let chapter = postdata["chapter"];
    chapter = JSON.parse(chapter.replace(/ *[\r|\n] */gm, ''));
    console.log(chapter);
    let name = chapter["name"];
    let description = chapter["description"];
    let section = parseInt(chapter["section"]);
    let level = parseInt(chapter["level"]);
    let ai = chapter["ai"];
    let isFight = chapter["isFight"];
    let expLimit = parseInt(chapter["expLimit"]);
    let firstCardAward = chapter["firstCardAward"];
    let generalCardAward = chapter["generalCardAward"];
    let expAward = parseInt(chapter["expAward"]);
    let firstCoinAward = parseInt(chapter["firstCoinAward"]);
    let generalCoinAward = parseInt(chapter["generalCoinAward"]);
    let context_begin = chapter["context_begin"];
    //filter
    if (context_begin != undefined) {
      console.log(typeof context_begin);
      console.log(context_begin);
      context_begin = JSON.stringify(context_begin);
    } else {
      context_begin = "[]";
    }

    let context_end = chapter["context_end"];
    if (context_end != undefined) {
      console.log(typeof context_end);
      console.log(context_end);
      context_end = JSON.stringify(context_end);
    } else {
      context_end = "[]";
    }
    if (description == undefined) description = "";
    if (section == undefined) section = 1;
    if (level == undefined) level = 0;
    if (ai == undefined) ai = "0";
    if (isFight == undefined) isFight = true;
    if (expLimit == undefined) expLimit = 0;
    if (firstCardAward == undefined || firstCardAward == "") firstCardAward = "[]";
    if (generalCardAward == undefined || generalCardAward == "") generalCardAward = "[]";
    if (expAward == undefined) expAward = 100;
    if (firstCoinAward == undefined) firstCoinAward = 10;
    if (generalCoinAward == undefined) generalCoinAward = 3;
    try {
      const res = await Chapter.where({
        id: chapter_id
      }).update({
        id: null,
        name: name,
        description: description,
        section: section,
        level: level,
        ai: String(ai),
        isFight: isFight,
        expLimit: expLimit,
        firstCardAward: String(firstCardAward),
        generalCardAward: String(generalCardAward),
        expAward: expAward,
        firstCoinAward: firstCoinAward,
        generalCoinAward: generalCoinAward,
        context_begin: context_begin,
        context_end: context_end
      });
      return this.success(res);
    } catch (e) {
      console.log(e);
      return this.fail(1004, Error['1004']);
    }
  }
  //TEST:添加章节信息
  async addChapterAction() {
    const Chapter = this.model('chapter');
    const postdata = this.post();
    let chapter = postdata["chapter"];
    try {
      chapter = JSON.parse(chapter.replace(/ *[\r|\n] */gm, ''));
    } catch (e) {
      console.log(e);
      return this.fail(1004, Error['1004']);
    }
    if (chapter.length == undefined) {
      console.log(chapter);
      let name = chapter["name"];
      let description = chapter["description"];
      let section = parseInt(chapter["section"]);
      let level = parseInt(chapter["level"]);
      let ai = parseInt(chapter["ai"]);
      let isFight = parseInt(chapter["isFight"]);
      let expLimit = parseInt(chapter["expLimit"]);
      let firstCardAward = chapter["firstCardAward"];
      let generalCardAward = chapter["generalCardAward"];
      let expAward = parseInt(chapter["expAward"]);
      let firstCoinAward = parseInt(chapter["firstCoinAward"]);
      let generalCoinAward = parseInt(chapter["generalCoinAward"]);
      let context_begin = chapter["context_begin"];
      if (name == undefined) {
        name = "第" + (level + 1) + "关";
      } else if (name.length == 0) {
        name = "第" + (level + 1) + "关";
      }
      //filter
      if (context_begin != undefined) {
        console.log(typeof context_begin);
        console.log(context_begin);
        context_begin = JSON.stringify(context_begin);
      } else {
        context_begin = "[]";
      }


      let context_end = chapter["context_end"];
      if (context_end != undefined) {
        console.log(typeof context_end);
        console.log(context_end);
        context_end = JSON.stringify(context_end);
      } else {
        context_end = "[]";
      }
      if (description == undefined) description = "";
      if (section == undefined) section = 1;
      if (level == undefined) level = 0;
      if (ai == undefined || isNaN(ai)) ai = 0;
      if (isFight == undefined || isNaN(isFight)) isFight = 1;
      if (expLimit == undefined) expLimit = 0;
      if (firstCardAward == undefined || firstCardAward == "") firstCardAward = "[]";
      if (generalCardAward == undefined || generalCardAward == "") generalCardAward = "[]";
      if (expAward == undefined) expAward = 100;
      if (firstCoinAward == undefined) firstCoinAward = 10;
      if (generalCoinAward == undefined) generalCoinAward = 3;
      try {
        const res = await Chapter.add({
          id: null,
          name: name,
          description: description,
          section: section,
          level: level,
          ai: String(ai),
          isFight: isFight,
          expLimit: expLimit,
          firstCardAward: String(firstCardAward),
          generalCardAward: String(generalCardAward),
          expAward: expAward,
          firstCoinAward: firstCoinAward,
          generalCoinAward: generalCoinAward,
          context_begin: context_begin,
          context_end: context_end
        });

      } catch (e) {
        console.log(e);
        return this.fail(1004, Error['1004']);
      }
      return this.success();
    } else {
      for (let i = 0; i < chapter.length; i++) {
        addEachChapter(chapter[i], Chapter);
      }
    }
  }
  async deleteChapterAction() {
    const Chapter = this.model('chapter');
    const postdata = this.post();
    let id = postdata["id"];
    try {
      let res = Chapter.where({
        id: id
      }).delete();
      return this.success(res);
    } catch (e) {
      return this.fail(1004, Error['1004']);
    }
  }
}
async function addEachChapter(chapter, Chapter) {
  let name = chapter["name"];
  let description = chapter["description"];
  let section = parseInt(chapter["section"]);
  let level = parseInt(chapter["level"]);
  let ai = parseInt(chapter["ai"]);
  let isFight = parseInt(chapter["isFight"]);
  let expLimit = parseInt(chapter["expLimit"]);
  let firstCardAward = chapter["firstCardAward"];
  let generalCardAward = chapter["generalCardAward"];
  let expAward = parseInt(chapter["expAward"]);
  let firstCoinAward = parseInt(chapter["firstCoinAward"]);
  let generalCoinAward = parseInt(chapter["generalCoinAward"]);
  let context_begin = chapter["context_begin"];
  if (name == undefined) {
    name = "第" + (level + 1) + "关";
  } else if (name.length == 0) {
    name = "第" + (level + 1) + "关";
  }
  //filter
  if (context_begin != undefined) {
    console.log(typeof context_begin);
    console.log(context_begin);
    context_begin = JSON.stringify(context_begin);
  } else {
    context_begin = "[]";
  }


  let context_end = chapter["context_end"];
  if (context_end != undefined) {
    console.log(typeof context_end);
    console.log(context_end);
    context_end = JSON.stringify(context_end);
  } else {
    context_end = "[]";
  }
  if (description == undefined) description = "";
  if (section == undefined) section = 1;
  if (level == undefined) level = 0;
  if (ai == undefined || isNaN(ai)) ai = 0;
  if (isFight == undefined || isNaN(isFight)) isFight = 1;
  if (expLimit == undefined) expLimit = 0;
  if (firstCardAward == undefined || firstCardAward == "") firstCardAward = "[]";
  if (generalCardAward == undefined || generalCardAward == "") generalCardAward = "[]";
  if (expAward == undefined) expAward = 100;
  if (firstCoinAward == undefined) firstCoinAward = 10;
  if (generalCoinAward == undefined) generalCoinAward = 3;
  try {
    const res = await Chapter.add({
      id: null,
      name: name,
      description: description,
      section: section,
      level: level,
      ai: String(ai),
      isFight: isFight,
      expLimit: expLimit,
      firstCardAward: String(firstCardAward),
      generalCardAward: String(generalCardAward),
      expAward: expAward,
      firstCoinAward: firstCoinAward,
      generalCoinAward: generalCoinAward,
      context_begin: context_begin,
      context_end: context_end
    });
  } catch (e) {
    console.log(e);
    return false;
  }
  return true;
}