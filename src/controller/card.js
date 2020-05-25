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
module.exports = class Card extends Base {
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
  //TEST:随机生成卡牌
  indexAction() {
    const postData = this.post();
    let cardsNum = postData['cardsNum'];
    // const player = postData['player'];
    cardsNum = cardsNum || 1;
    const cardList = [];
    let eachCard;
    for (let i = 0; i < cardsNum; i++) {
      eachCard = auto_generate_effect();
      cardList.push({'effect': eachCard, 'description': auto_generate_description(eachCard)});
    }
    this.success(cardList);
    return cardList;
  }

  async selectCardsAction() {
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
    console.log("User <" + NowUser["username"] + "> request cards data.");
    let card = this.model('card');
    //过滤disable的卡牌
    let res = await card.where({state: "enable"}).select();
    return this.success(res);
  }
  async selectOneCardAction() {
    let postdata = this.post();
    let username = postdata["username"];
    let password = postdata["password"];
    let card_id = postdata["card_id"];
    let userInfo = await Player.login(username, password);
    if (userInfo["errno"] != 0) {
      // Login Error
      return userInfo;
    } else {
      NowUser = userInfo["data"]["userinfo"];
    }
    console.log("User <" + NowUser["username"] + "> request one card data(id: " + card_id + ").");
    let card = this.model('card');
    let res = await card.where({"id": card_id}).select();
    return this.success(res);
  }

  static async dealer(cardsNum, user_serial_num, userinfo, mode) {
    let card_model = think.model('card');
    let player = think.model("player");
    let nowCard;
    //给技能的effect赋值 source
    if (userinfo["skill"] == undefined) {
      console.log(consoleSymbol["no"] + " No skill effect when dealer.");
    }
    userinfo["skill"]["source"] = user_serial_num;
    userinfo["skill"]["card_id"] = undefined;
    let nowSkillEffect = userinfo["skill"];
    while (nowSkillEffect["other_card_effect"] != undefined) {
      nowSkillEffect = nowSkillEffect['other_card_effect'];
      nowSkillEffect['source'] = user_serial_num;
    }

    mode = mode || 'normal_random';
    //初始化mode的发牌方式
    if (GameMode['normal_random_generate'] === undefined) {
      //使用随机生成的卡牌
      let mode_function = function(cardsNum, user_serial_num) {
        cardsNum = cardsNum || 1;
        let cardList = [];
        let eachCard;
        for (let i = 0; i < cardsNum; i++) {
          eachCard = auto_generate_effect();
          // 在发牌的时候要将所有card的source初始化为该用户的user_serial_num
          // 由于other_card_effect的存在,source的初始化是一个迭代过程
          nowCard = eachCard;
          nowCard['source'] = user_serial_num;
          while (nowCard["other_card_effect"] != undefined) {
            nowCard = nowCard['other_card_effect'];
            nowCard['source'] = user_serial_num;
          }

          if (eachCard === undefined || eachCard === null) {
            console.log('[*] Error: Generate randomly card is null!');
          }
          cardList.push({'effect': eachCard, 'description': auto_generate_description(eachCard)});
        }
        return cardList;
      };
      GameMode['normal_random_generate'] = mode_function;
    }
    if (GameMode['normal_random'] === undefined) {
      let mode_function = async function(cardsNum, user_serial_num) {
        //从数据库的牌库里取牌
        let cardList = [];
        let eachCard;
        let random_card;
        let cards = await card_model.select();
        if (cards.length < cardsNum) {
          cardsNum = cards.length;
          console.log(consoleSymbol["info"], " 发牌: 可用卡牌数量小于牌库数量");
        }

        for (let i = 0; i < cardsNum; i++) {
          //随机选取list中的一张牌加入cardList,直到数量满了
          random_card = yiRan(0, cards.length - 1, 1);
          if (cards[random_card] === null) {
            random_card = yiRan(0, cards.length - 1, 1);
          }
          eachCard = cards[random_card]['effect'];
          eachCard = JSON.parse(eachCard);
          // 在发牌的时候要将所有card的source初始化为该用户的user_serial_num
          // 由于other_card_effect的存在,source的初始化是一个迭代过程
          nowCard = eachCard;
          nowCard['source'] = user_serial_num;
          while (nowCard["other_card_effect"] != undefined) {
            nowCard = nowCard['other_card_effect'];
            nowCard['source'] = user_serial_num;
          }
          eachCard['card_id'] = cards[random_card]['id'];
          cardList.push({
            'id': cards[random_card]['id'], 'name': cards[random_card]['name'], 'description': cards[random_card]['description'],
            // 'description_auto': auto_generate_description(eachCard),
            'effect': eachCard,
            'story': cards[random_card]['story']
          });
        }
        return cardList;
      };
      GameMode['normal_random'] = mode_function;
    }
    //给冒险的player发牌,此时cardNum一点用都没有
    if (GameMode['adventure_player'] === undefined) {
      let mode_function = async function(cardsNum, user_serial_num) {
        //获取单人冒险的玩家的临时牌库
        let cardList = [];
        let tmp_list = [];
        let CardsMap = new Map();
        let eachCard;
        let cardCost,
          cardRare;
        try {
          let userdata = await player.where({id: userinfo["id"]}).select();

          tmp_list = JSON.parse(userdata[0]["tmp_collection"]);

          let cards = await card_model.select();
          console.log(consoleSymbol["info"] + " 测试冒险玩家发牌:", tmp_list);

          for (let i = 0; i < cards.length; i++) {
            cards[i]["effect"] = JSON.parse(cards[i]["effect"]);
            CardsMap.set(cards[i]["id"], cards[i]);
          };
          for (let i = 0; i < tmp_list.length; i++) {
            eachCard = CardsMap.get(tmp_list[i]);
            console.log(consoleSymbol["info"] + " 测试冒险玩家发牌数据结构:", eachCard);
            nowCard = eachCard["effect"];
            cardCost = nowCard['card_cost'];
            cardRare = nowCard['card_rare'];
            nowCard['source'] = user_serial_num;
            while (nowCard["other_card_effect"] != undefined) {
              nowCard = nowCard['other_card_effect'];
              nowCard['source'] = user_serial_num;
              nowCard['card_id'] = eachCard['id'];
              nowCard['card_cost'] = cardCost;
              nowCard['card_rare'] = cardRare;
            }
            eachCard["effect"]['card_id'] = tmp_list[i];
            cardList.push({
              'id': tmp_list[i], 'name': eachCard["name"], 'description': eachCard['description'],
              // 'description_auto': auto_generate_description(eachCard),
              'effect': eachCard["effect"],
              'story': eachCard['story']
            });
          }
        } catch (e) {
          console.log(consoleSymbol["no"] + " Error: Can not get an invalid tmp_collection when dealer for adventure_player.");
          console.log(e);
        }
        //返回牌之前shuffle一下
        if (cardList.length > 0) {
          //shuffle 整个cards_pool,以免每次抽出来的牌都一样
          //shuffle实现为Durstenfeld shuffle
          for (let i = cardList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = cardList[i];
            cardList[i] = cardList[j];
            cardList[j] = temp;
          }
        }
        return cardList;
      };
      GameMode['adventure_player'] = mode_function;
    }
    if (GameMode['adventure_ai'] === undefined) {
      let mode_function = async function(cardsNum, user_serial_num) {
        //为单人冒险的AI发牌，暂时的游戏模式单人冒险的AI没有手牌,只有技能
        let cardList = [];
        return cardList;
      };
      GameMode['adventure_ai'] = mode_function;
    }
    for (let i in GameMode) {
      if (i === mode) {
        let res = await GameMode[i](cardsNum, user_serial_num);
        return res;
      }
    }
  }
  // TEST:评估卡牌 : 未完成
  // async evaluteCardAction() {
  //   let card = this.modle("card");
  //   let cardData = card.select();
  //   使用评估函数来评估卡牌价值
  //   let eva = function(card_effect) {
  //     let score = 0;
  //     基础属性分数
  //     score += 2 * card_effect["damage"] + 2.5 * card_effect["cards"] + 3 * card_effect["star"] + 1 * card_effect["protect"];
  //     if (card_effect["extra_function"] != undefined) {
  //       如果有额外函数的话,就多得费用*5分
  //       score += card_effect["card_cost"] * 5;
  //     }
  //     if (card_effect["buff_turn"] != undefined) {
  //       score *= card_effect["buff_turn"] * score * 0.75;
  //     }
  //     if (card_effect["condition"] != undefined) {
  //       score *= score * 0.65;
  //     }
  //     return score;
  //   }
  // }
  // TEST:修改卡牌
  // async editCardAction() {
  //   const card = this.model('card');
  //   const postdata = this.post();
  //   const card_id = postdata["id"];
  //   const name = postdata['name'];
  //   const description = postdata['description'];
  //   const img = postdata['img'];
  //   const img_bak = postdata['img_bak'];
  //   const animation = postdata['animation'];
  //   const sound = postdata['sound'];
  //   const type = postdata['type'];
  //   const state = postdata['state'];
  //   let effect = postdata['effect'].replace(/ *[\r|\n] */gm, '');
  //   console.log(effect);
  //   effect = JSON.stringify(JSON.parse(effect));
  //   console.log(effect);
  //   const description_auto = "";
  //   const story = postdata['story'];
  //   const card_cost = effect['card_cost'];
  //   const card_rare = effect['card_rare'];
  //   try {
  //     const res = await card.where({id: card_id}).update({
  //       name: name,
  //       description: description,
  //       description_auto: description_auto,
  //       img: img,
  //       img_bak: img_bak,
  //       animation: animation,
  //       sound: sound,
  //       type: type,
  //       time: new Date().getTime(),
  //       state: state,
  //       effect: effect,
  //       card_cost: card_cost,
  //       card_rare: card_rare,
  //       story: story
  //     });
  //     return this.success(res);
  //   } catch (e) {
  //     console.log(e);
  //     return this.fail(1004, Error['1004']);
  //   }
  // }
  // TEST:添加卡牌
  // async addCardAction() {
  //   const card = this.model('card');
  //   const postdata = this.post();
  //   const name = postdata['name'];
  //   const description = postdata['description'];
  //   const img = postdata['img'];
  //   const img_bak = postdata['img_bak'];
  //   const animation = postdata['animation'];
  //   const sound = postdata['sound'];
  //   const type = postdata['type'];
  //   const state = postdata['state'];
  //   let effect;
  //   try {
  //     effect = postdata['effect'].replace(/ *[\r|\n] */gm, '');
  //     effect = JSON.stringify(JSON.parse(effect));
  //   } catch (e) {
  //     console.log(e);
  //     return this.fail(1004, Error['1020']);
  //   }
  //   const card_cost = effect['card_cost'];
  //   const card_rare = effect['card_rare'];
  //   const description_auto = "";
  //   const story = postdata['story'];
  //   try {
  //     const res = await card.add({
  //       id: null,
  //       name: name,
  //       description: description,
  //       description_auto: description_auto,
  //       img: img,
  //       img_bak: img_bak,
  //       animation: animation,
  //       sound: sound,
  //       type: type,
  //       time: new Date().getTime(),
  //       state: state,
  //       effect: effect,
  //       card_cost: card_cost,
  //       card_rare: card_rare,
  //       story: story
  //     });
  //     return this.success(res);
  //   } catch (e) {
  //     console.log(e);
  //     return this.fail(1004, Error['1004']);
  //   }
  // }

  // TEST:按照id分类规则重设id,根据effect['card_rare']/['card_cost']重新设置card_rare和card_cost
  // async classifyCardAction() {
  //   let card = this.model("card");
  //   let cardData = await card.select();
  //   let N = 10000,
  //     R = 20000,
  //     SR = 30000,
  //     SSR = 40000;
  //   let avoidDuplicate = 100000;
  //   for (let i in cardData) {
  //     await card.where({id: cardData[i]["id"]
  //     }).update({id: avoidDuplicate});
  //     avoidDuplicate++;
  //   }
  //   cardData = await card.select();
  //   for (let i in cardData) {
  //     let effect = JSON.parse(cardData[i]["effect"]);
  //     console.log(effect["card_rare"]);
  //     if (effect["card_rare"] == "N") {
  //       await card.where({id: cardData[i]["id"]
  //       }).update({id: N, card_rare: effect['card_rare'], card_cost: effect['card_cost']});
  //       N++;
  //     } else if (effect["card_rare"] == "R") {
  //       await card.where({id: cardData[i]["id"]
  //       }).update({id: R, card_rare: effect['card_rare'], card_cost: effect['card_cost']});
  //       R++;
  //     } else if (effect["card_rare"] == "SR") {
  //       await card.where({id: cardData[i]["id"]
  //       }).update({id: SR, card_rare: effect['card_rare'], card_cost: effect['card_cost']});
  //       SR++;
  //     } else if (effect["card_rare"] == "SSR") {
  //       await card.where({id: cardData[i]["id"]
  //       }).update({id: SSR, card_rare: effect['card_rare'], card_cost: effect['card_cost']});
  //       SSR++;
  //     }
  //   }
  //   return this.success();
  // }
};

function auto_generate_effect() {
  let effect = {
    pointer: yiRan(0, 0, 0, 2, {
      1: 0.4,
      2: 0.3,
      3: 0.1,
      4: 0.2
    }),
    damage: parseInt(yiRan(0, 0, 0, 2, {
      999: 0.01,
      10: 0.03,
      6: 0.02,
      5: 0.04,
      4: 0.05,
      3: 0.08,
      2: 0.07,
      1: 0.05,
      0: 0.4,
      //0.25
      '-3': 0.1,
      '-6': 0.07,
      '-9': 0.04,
      '-12': 0.03,
      '-999': 0.01
    }), 10),
    cards: parseInt(yiRan(-5, 5, 0, 2, {
      '-999': 0.01,
      '-2': 0.04,
      '-1': 0.1,
      '0': 0.4,
      '1': 0.2,
      '2': 0.12,
      '3': 0.08,
      '5': 0.04,
      '999': 0.01
    }), 10),
    star: parseInt(yiRan(0, 2, 0, 2, {
      '999': 0.01,
      '-2': 0.04,
      '-1': 0.05,
      '0': 0.5,
      '1': 0.29,
      '2': 0.1,
      '-999': 0.01
    }), 10),
    protect: parseInt(yiRan(0, 10, 0, 2, {
      '1000': 0.01,
      '999': 0.01,
      '0': 0.50,
      '-3': 0.2,
      '-5': 0.1,
      '-6': 0.07,
      '-9': 0.06,
      '-12': 0.03,
      '-999': 0.01,
      '-1000': 0.01
    })),
    extra_turn: parseInt(yiRan(0, 1, 0, 2, {
      '1': 0.1,
      '0': 0.9
    })),
    buff_turn: parseInt(yiRan(0, 3, 0, 2, {
      '0': 0.7,
      '1': 0.1,
      '2': 0.1,
      '3': 0.095,
      '999': 0.005
    }), 10),
    settlement: parseInt(yiRan(1, 2, 0, 2, {
      '1': 0.5,
      '2': 0.5
    })),
    condition: {
      pointer: yiRan(0, 0, 0, 2, {
        0: 0.5,
        1: 0.2,
        2: 0.15,
        3: 0.05,
        4: 0.1
      })
    }
  };
  //生成condition的约束条件
  if (effect.condition.pointer !== 0) {
    //生成condition operand
    let operand_list = [
      'cute_value_operand',
      'cards_value_operand", "star_value_operand',
      'protect_value_operand',
      'damage_operand',
      'cards_operand',
      'star_operand',
      'protect_operand'
    ];
    for (var k in operand_list) {
      effect['condition'][operand_list[k]] = yiRan(0, 5, 2, 2, {
        '=': 0.2,
        '>': 0.2,
        '<': 0.2,
        '>=': 0.2,
        '<=': 0.2
      });
    }
    let time_list = ['condition_time'];
    for (k in time_list) {
      effect['condition'][time_list[k]] = parseInt(yiRan(1, 2, 2, 2, {
        '1': 0.5,
        '2': 0.5
      }));
    }
    effect.condition.cute_value = parseInt(yiRan(0, 40, 2, 2, {
      '40': 0.1,
      '30': 0.1,
      '25': 0.2,
      '15': 0.1,
      '0': 0.5
    }));
    effect.condition.cards_value = parseInt(yiRan(0, 8, 2, 2, {
      '8': 0.15,
      '4': 0.1,
      '1': 0.05,
      '0': 0.2,
      '-1': 0.5
    }));
    effect.condition.star_value = parseInt(yiRan(0, 12, 2, 2, {
      '12': 0.3,
      '7': 0.1,
      '0': 0.1,
      '-1': 0.5
    }));
    effect.condition.protect_value = parseInt(yiRan(0, 30, 2, 2, {
      '5': 0.1,
      '15': 0.1,
      '30': 0.1,
      '0': 0.1,
      '-1': 0.5,
      '1000': 0.05,
      '-1000': 0.05
    }));
    effect.condition.damage = parseInt(yiRan(-10, 10, 2, 2, {
      '0': 0.4,
      '1': 0.2,
      '-1': 0.2,
      '10': 0.05,
      '-10': 0.05,
      '6': 0.05,
      '-6': 0.05
    }));
    effect.condition.cards = parseInt(yiRan(-8, 8, 2, 2, {
      '0': 0.5,
      '1': 0.15,
      '-1': 0.15,
      '2': 0.05,
      '-2': 0.05,
      '8': 0.05,
      '-8': 0.05
    }));
    effect.condition.star = parseInt(yiRan(-12, 12, 2, 2, {
      '0': 0.5,
      '1': 0.1,
      '-1': 0.1,
      '2': 0.1,
      '-2': 0.1,
      '12': 0.05,
      '-12': 0.05
    }));
    effect.condition.protect = parseInt(yiRan(-30, 30, 2, 2, {
      '0': 0.5,
      '30': 0.01,
      '-30': 0.01,
      '15': 0.04,
      '-15': 0.04,
      '5': 0.1,
      '-5': 0.1,
      '3': 0.1,
      '-3': 0.1
    }));
    effect.condition.secret = yiRan(0, 1, 2, 2, {
      'true': 0.7,
      'false': 0.3
    });
  }
  //计算卡牌cost
  var card_cost = 0;
  for (var num in effect) {
    if (num !== 'condition' && num !== 'extra_turn' && num !== 'buff_turn' && num !== 'settlement') {
      card_cost += parseInt(effect[num], 10) > 0
        ? parseInt(effect[num], 10)
        : (-1 * parseInt(effect[num], 10));
    } else if (num === 'extra_turn') {
      card_cost += parseInt(effect[num], 10) * 50;
    } else if (num === 'buff_turn') {
      card_cost = card_cost * parseInt(effect[num], 10);
    } else if (num === 'condition') {
      for (var c in effect[num]) {
        if (isNaN(parseInt(effect[num][c], 10))) {
          card_cost += 0;
        } else {
          card_cost += parseInt(effect[num][c], 10) > 0
            ? parseInt(effect[num][c], 10)
            : (-1 * parseInt(effect[num][c], 10));
        }
      }
    }
  }
  if (card_cost > 72) {
    card_cost = 6 * 15;
  }
  if (card_cost < 0) {
    card_cost = 0;
  }
  effect.card_cost = Math.round(card_cost / 6);
  effect.card_rare = yiRan(0, 5, 1, 2, {
    'N': 0.4,
    'R': 0.3,
    'SR': 0.2,
    'UR': 0.08,
    'SSR': 0.02
  });
  return effect;
}

function auto_generate_description(effect_list) {
  let operand_text = {
    '=': '等于',
    '<': '小于',
    '>': '大于',
    '>=': '大于等于',
    '<=': '小于等于'
  };
  let condition_time = {
    '1': '之前',
    '2': '之后'
  };
  let description_auto = [];
  let _e;
  if (effect_list.length === undefined) {
    let effect_item = effect_list;
    effect_list = [];
    effect_list.push(effect_item);
  }
  if (effect_list.length !== undefined) {
    for (var i in effect_list) {
      _e = effect_list[i];
      let pointer = false;
      let buff_turn = false;
      let condition = false;
      //优先级5  condition启动
      if (_e['condition'] !== undefined && _e['condition']['pointer'] === 1 || _e['condition']['pointer'] === 2 || _e['condition']['pointer'] === 3 || _e['condition']['pointer'] === 4) {
        condition = true;
        description_auto = ['当'];

        if (_e['condition']['pointer'] === 1) {
          description_auto.push('己方');
        }
        if (_e['condition']['pointer'] === 2) {
          description_auto.push('对方');
        }
        if (_e['condition']['pointer'] === 3) {
          description_auto.push('双方');
        }
        if (_e['condition']['pointer'] === 4) {
          description_auto.push('随机目标');
        }
        //condition 静态条件描述
        if (_e['condition']['cute_value'] !== 0) {
          description_auto.push('萌化值' + operand_text[_e['condition']['cute_value_operand']] + String(_e['condition']['cute_value']) + ',');
        }
        if (_e['condition']['cards_value'] !== -1) {
          description_auto.push('手牌数量' + operand_text[_e['condition']['cards_value_operand']] + String(_e['condition']['cards_value']) + ',');
        }
        if (_e['condition']['star_value'] !== -1) {
          description_auto.push('星星数量' + operand_text[_e['condition']['star_value_operand']] + String(_e['condition']['star_value']) + ',');
        }
        if (_e['condition']['protect_value'] !== -1) {
          if (_e['condition']['protect_value'] === -1000) {
            description_auto.push('本局无法再获得免疫值,');
          } else if (_e['condition']['protect_value'] === 1000) {
            description_auto.push('处于免疫状态,');
          } else {
            description_auto.push('冷漠值' + operand_text[_e['condition']['protect_value_operand']] + String(_e['condition']['protect_value']) + ',');
          }
        }
        //去除结尾,改为'时'
        if (description_auto[description_auto.length - 1][description_auto[description_auto.length - 1].length - 1] === ',') {
          description_auto[description_auto.length - 1] = description_auto[description_auto.length - 1].slice(0, description_auto[description_auto.length - 1].length - 1) + '时,';
        }
        //condition 动态条件描述
        description_auto.push(['在']);
        if (_e['condition']['damage'] !== 0) {
          description_auto.push('受到');
          // +  + String(_e['condition']['damage']) + ','
          if (_e['condition']['damage'] > 0) {
            description_auto.push(operand_text[_e['condition']['damage_operand']] + String(_e['condition']['damage']) + '点的萌化值增加' + ',');
          } else {
            description_auto.push(operand_text[_e['condition']['damage_operand']] + String(-1 * _e['condition']['damage']) + '点的萌化值减少' + ',');
          }
        }
        if (_e['condition']['cards'] !== 0) {
          description_auto.push('手牌');
          // +  + String(_e['condition']['cards']) + ','
          if (_e['condition']['cards'] > 0) {
            description_auto.push('获得抽取量' + operand_text[_e['condition']['cards_operand']] + String(_e['condition']['cards']) + '张' + ',');
          } else {
            description_auto.push('被弃置' + operand_text[_e['condition']['cards_operand']] + String(-1 * _e['condition']['cards']) + '张' + ',');
          }
        }
        if (_e['condition']['star'] !== 0) {
          description_auto.push('星星');
          // +  + String(_e['condition']['star']) + ','
          if (_e['condition']['star'] > 0) {
            description_auto.push('增加量' + operand_text[_e['condition']['star_operand']] + String(_e['condition']['star']) + '个' + ',');
          } else {
            description_auto.push('损失量' + operand_text[_e['condition']['star_operand']] + String(-1 * _e['condition']['star']) + '个' + ',');
          }
        }
        if (_e['condition']['protect'] !== 0) {
          description_auto.push('冷漠值');
          if (_e['condition']['protect'] > 0) {
            description_auto.push('增加量' + operand_text[_e['condition']['protect_operand']] + String(_e['condition']['protect']) + '点' + ',');
          } else {
            description_auto.push('减少量' + operand_text[_e['condition']['protect_operand']] + String(-1 * _e['condition']['protect']) + '点' + ',');
          }
        }
        //去除结尾,改为'condition_time'
        if (_e['condition']['damage'] !== 0 || _e['condition']['cards'] !== 0 || _e['condition']['star'] !== 0 || _e['condition']['protect'] !== 0) {
          if (description_auto[description_auto.length - 1][description_auto[description_auto.length - 1].length - 1] === ',') {
            description_auto[description_auto.length - 1] = description_auto[description_auto.length - 1].slice(0, description_auto[description_auto.length - 1].length - 1) + condition_time[_e['condition']['condition_time']] + ',';
          }
        } else {
          description_auto[description_auto.length - 1] = '';
        }
      }
      if (_e['pointer'] === 1) {
        pointer = true;
        description_auto.push('己方');
      }
      if (_e['pointer'] === 2) {
        pointer = true;
        description_auto.push('对方');
      }
      if (_e['pointer'] === 3) {
        pointer = true;
        description_auto.push('双方');
      }
      if (_e['pointer'] === 4) {
        pointer = true;
        description_auto.push('使随机目标');
      }
      //pointer存在
      if (pointer === true) {
        //无事发生
        if (_e['cards'] === 0 && _e['damage'] === 0 && _e['star'] === 0 && _e['buff_turn'] === 0 && _e['protect'] === 0) {
          if (condition) {
            description_auto.push('喵喵叫.');
          } else {
            description_auto = ['喵喵叫.'];
          }
          continue;
        }

        //特殊值判断
        if (_e['damage'] === 999) {
          description_auto.push('直接取得胜利.');
          continue;
        }
        if (_e['damage'] === -999) {
          description_auto.push('萌化值清零.');
          continue;
        }
        if (_e['cards'] === 999) {
          description_auto.push('抽取牌库中剩下的所有牌.');
          continue;
        }
        if (_e['cards'] === -999) {
          description_auto.push('弃掉手上的所有卡牌.');
          continue;
        }
        if (_e['star'] === 999) {
          description_auto.push('获得星星至最大数量.');
          continue;
        }
        if (_e['star'] === -999) {
          description_auto.push('星星减少到0个.');
          continue;
        }
        if (_e['protect'] === 999) {
          description_auto.push('抵消本次萌化值增加,');
          continue;
        }
        if (_e['protect'] === 1000) {
          description_auto.push('免疫任何萌化值增加或减少,');
          continue;
        }
        if (_e['protect'] === -999) {
          description_auto.push('清除所有冷漠值,');
          continue;
        }
        if (_e['protect'] === -1000) {
          description_auto.push('本局对战中无法再增加冷漠值,');
          continue;
        }

        if (_e['buff_turn'] > 0) {
          if (_e['cards'] === 0 && _e['damage'] === 0 && _e['star'] === 0 && _e['protect'] === 0 && _e['extra_turn'] === 0) {
            description_auto = ['喵喵叫'];
            continue;
          }
          buff_turn = true;
        }
        if (buff_turn === true) {
          if (_e['settlement'] <= 0) {
            //wrong buff_turn. exit now.
            console.log('wrong buff_turn. exit now.');
            continue;
          }
          description_auto.push('每回合');
          if (_e['settlement'] === 1) {
            description_auto.push('开始时,');
          }
          if (_e['settlement'] === 2) {
            description_auto.push('结束时,');
          }
        }
        /**************************************基础效果***************************************/
        if (_e['extra_turn'] > 0) {
          description_auto.push('额外获得' + String(_e['extra_turn']) + '个回合,');
        }
        if (_e['damage'] > 0) {
          description_auto.push('增加' + String(_e['damage']) + '点萌化值,');
        }
        if (_e['damage'] < 0) {
          description_auto.push('减少' + String(-1 * _e['damage']) + '点萌化值,');
        }
        if (_e['cards'] > 0) {
          description_auto.push('抽取' + String(_e['cards']) + '张卡牌,');
        }
        if (_e['cards'] < 0) {
          description_auto.push('随机弃掉' + String(-1 * _e['cards']) + '张卡牌,');
        }
        if (_e['star'] > 0) {
          description_auto.push('增加' + String(_e['star']) + '个星星,');
        }
        if (_e['star'] < 0) {
          description_auto.push('减少' + String(-1 * _e['star']) + '个星星,');
        }
        if (_e['protect'] < 0) {
          description_auto.push('减少' + String(-1 * _e['protect']) + '点冷漠值,');
        }
        if (_e['protect'] > 0) {
          description_auto.push('增加' + String(_e['protect']) + '点冷漠值,');
        }
        /* *************************************buff效果************************************** */
        if (buff_turn === true) {
          if (_e['buff_turn'] === 999) {
            description_auto.push('本局对战中永久生效,');
          } else {
            description_auto.push('持续' + String(_e['buff_turn']) + '回合,');
          }
        }
        //去除结尾,改为.
        if (description_auto[description_auto.length - 1][description_auto[description_auto.length - 1].length - 1] === ',') {
          description_auto[description_auto.length - 1] = description_auto[description_auto.length - 1].slice(0, description_auto[description_auto.length - 1].length - 1) + '.';
        }
        //此卡牌是否为奥秘
        if (_e['condition']['secret'] === 'true' || _e['condition']['secret'] === true) {
          description_auto.push(' (奥秘)');
        }
      }
    }
  }
  let description_text = '';
  for (let i in description_auto) {
    description_text += description_auto[i];
  }
  if (description_text.length === 0) {
    console.log('Wrong text generate');
    console.log(effect_list[0]);
  }
  return description_text;
}
