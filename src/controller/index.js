const Base = require('./base.js');

module.exports = class extends Base {
  //TEST:
  indexAction() {
    return this.display();
  }
  //TEST:
  cardsAddAction() {
    return this.display();
  }
  //TEST:
  userAction() {
    return this.display();
  }
  //TEST:
  cardsAction() {
    return this.display();
  }
  //TEST:
  changeAction() {
    return this.display();
  }
  //TEST:
  testAction() {
    return this.display();
  }
  //TEST:
  chapterAddAction() {
    return this.display();
  }
  //TEST:
  chapterAction() {
    return this.display();
  }
  //TEST:
  monsterAddAction() {
    return this.display();
  }
  //TEST:
  monsterUpdateAction() {
    return this.display();
  }
  //TEST:
  monstersAction() {
    return this.display();
  }
  //TEST:
  resourceAddAction() {
    return this.display();
  }
  //TEST:
  resourceAction() {
    return this.display();
  }
  //TEST:
  officialMailAction() {
    return this.display();
  }
  mailsAction() {
    return this.display();
  }
  //TEST:
  interfaceAction() {
    let now_page = "main";
    this.assign("page", now_page);
    return this.display();
  }
};