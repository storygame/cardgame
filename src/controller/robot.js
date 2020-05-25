const Game = require("./ai_static.js");
var __reflect = (this && this.__reflect) || function(p, c, t) {
  p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var AI = (function() {
  function AI(gameInfo) {
    this.initGameInfo = gameInfo;
    this.cards = AI.Me(gameInfo)['cards_list'];
  }
  AI.Me = function(gameInfo) {
    return gameInfo['player2'];
  };
  //没有game_info的时候才用的方法,已弃用
  AI.start = function() {
    var gameInfo = Game.gameInit();
    //if(gameInfo['errno'] != 0)
    //pass
    var me = AI.Me(gameInfo);
    gameInfo = Game.beginTurn(gameInfo, me);
    var ai = new AI(gameInfo);
    var result = ai.run();
    //console.log("success init for ai");
    return result;
  };
  AI.prototype.run = function() {
    var me = AI.Me(this.initGameInfo);
    //搜索的任何时候的手牌
    this.cardList = [];
    //搜索过程中的使用的卡牌的序列
    this.searchCards = [];
    //全部可能的出牌方式和评分
    this.scores = [];
    for (let i = 0; i < this.cards.length; i = i + 1) {
      this.cardList.push(i); //from 0
    }
    //评估最初始的局势
    var score = AI.evaluate(this.initGameInfo);

    //if(gameInfo['errno'] != 0)
    //pass
    //console.log("Try cards:", this.cardList, this.cards.length);
    for (let i_1 in this.cardList) {
      if (this.cardList[i_1] == undefined) {
        continue;
      }
      if (me['now_star'] >= this.cards[this.cardList[i_1]]['effect']['card_cost']) {
        this.search(this.cardList[i_1], 0, this.initGameInfo, score);
      } else {
        //console.log(i_1, " out of range.");
      }
    }
    var result = this.finalList();
    return result;
  };
  AI.singleScore = function(player) {
    var cute_value = player['cute_value'];
    var protect_value = player['protect_value']; // 暂时没考虑protect_special
    var cards_list = player['cards_list'];
    var star_value = player['star_value'];
    var now_value = player['now_value']; // 暂时没考虑now_value的价值
    var cards_pool = player['cards_pool'];
    var buff_list = player['buff_list'];
    var condition_list = player['condition_list'];
    var secret_condition_list = player['secret_condition_list'];

    if (cute_value >= 40) {
      //直接去世
      return -9999;
    } else {
      // cute_value -2 分 2 * 40 = 80
      // buff_list 7 分 / 个
      // cards_pool 0.2 分 0.5 * 40 = 20(牌库数量大于30得分为正数, 否则为负数)
      // condition_list 4 分 / 个
      // secret_list 6 分 / 个
      // protect_value 1.5 分 / 个
      // star_value 3 分 / 个 15 * 3 = 45
      // cards_list 5 分 / 个 5 * 8 = 40
      let score = -2 * cute_value + buff_list.length * 7 + condition_list.length * 4 +
        1.5 * protect_value + secret_condition_list.length * 6 + star_value * 3 + cards_list.length * 5;
      if (cards_pool.length > 20) {
        score += cards_pool.length * 0.5;
      } else {
        score -= cards_pool.length * 0.5;
      }
      return score;
    }
  };
  AI.evaluate = function(gameInfo) {
    var data = gameInfo;
    var player1 = data['player1'];
    var player2 = data['player2'];
    var me, enemy;
    if (player1['id'] == 0) {
      me = player1;
      enemy = player2;
    } else {
      me = player2;
      enemy = player1;
    }
    if (data["game_status"]["FINISHED"] != undefined) {
      //danger!
      if (data["game_status"]["FINISHED"]["id"] == enemy["id"]) {
        //玩家取得胜利
        score = -9999;
        return score;
      }
    }
    var score = 2 * AI.singleScore(me) - AI.singleScore(enemy);
    if (isNaN(score)) {
      console.log("Error: score is NaN!");
    }

    var extra_turn = data["extra_turn"];
    if (extra_turn["player1"] > 0) {
      //玩家有额外的回合
      score += extra_turn["player1"] * (player1["buff_list"].length + 17);
    }
    if (extra_turn["player2"] > 0) {
      //AI有额外的回合
      score += extra_turn["player2"] * (player2["buff_list"].length + 17);
    }
    // score += 3 * extra_turn;
    return score;
  };
  AI.prototype.search = function(card, depth, gameInfo, lastScore) {
    var _this = this;
    var me = gameInfo["player2"];
    console.log("try use card: ",me["cards_list"][card]["name"],me["cards_list"].length );
    //调用useOneCard并不会对原有的cardList造成影响
    //使用卡牌前输出卡片信息
    // console.log(gameInfo["player2"]["cards_list"][card]["effect"]["source"]);
    var response = Game.useOneCard(gameInfo, me, card);
    me = response["player2"];
    // 重新生成this.cardList,这样导致最后返回的卡牌序列是可重复的,在使用过程数组index为动态的！！
    let new_cardList=[];
    for (let i = 0; i < me['cards_list'].length; i = i + 1) {
      new_cardList.push(i); //重新生成一个序列
    }

    var score = AI.evaluate(response);
    if(score==-9999){
      console.log("AI使用牌 "+String(card)+" 会输");
    }
    this.searchCards.push(parseInt(card));
    if (depth >= 3) {
      this.searchCards.pop();
      this.scores.push([score, this.searchCards.concat()]);
      return;
    } else {
        //console.log("Try more deep cards:", this.cardList, this.cards.length, response["player2"]["cards_list"].length);
        //console.log("Now searchCards:", this.searchCards);
        for (let element in new_cardList) {
          //me["cards_list"]才是搜索过程中你的真正手牌,因为有牌已经被用了,索引与this.cards已经不一致了
          if (me['star_value'] >= me["cards_list"][element]['effect']['card_cost']) {
            //只需要往下传就行了,response作为新的game_info,所以索引不会出错
            _this.search(element, depth + 1, response, score);
          }
        }
    }
    //本次搜索的下层已经在上面运行过了,这里是同层,所以去除现在使用的卡牌
    this.scores.push([score, this.searchCards.concat()]);
    this.searchCards.pop();
    return;
  };
  AI.prototype.finalList = function() {
    //console.log("finnal scores: ", this.scores);
    if (this.scores.length > 0) {
      console.log("所有的策略: ", this.scores);
      this.scores.sort(function(l1, l2) {
        return l2[0] - l1[0];
      });

      var score_1 = this.scores[0][0];
      var tmp_1 = [];
      this.scores.forEach(function(element) {
        //console.log("score: ", element);
        if (element[0] == score_1) {
          tmp_1.push(element);
        }
      });
      //尽量选少出牌并且分还高的策略
      tmp_1.sort(function(l1, l2) {
        return l1[1].length - l2[1].length;
      }); //正序
      return tmp_1[0][1];
    } else {
      console.log("AI 不想出任何牌");
      return [];
    }
  };
  return AI;
}());
__reflect(AI.prototype, "robot");
//# sourceMappingURL=AI.js.map
module.exports = AI;
