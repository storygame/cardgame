;
(function(_I, _F, _S) {
  this.yiRan = function(_A, _Q, _e, _k, _i) {
    var _wei = function(_v) {
      var _a = _v,
        _b;
      var _c = _a.indexOf(".");
      if (_c != -1) {
        var _d = _a.substring(_c + 1, _a.length);
        _b = _d.length
      } else {
        _b = "+" + _a.length
      }
      return _b
    };
    var _p = "number",
      _lsl = "object";
    var _ee = function() {
      if (this._k == 0) {
        if ((typeof this._A != _p) || (typeof this._Q != _p)) {
          throw ("error:001");
        }
        if (typeof this._e != _p) throw ("error:002");
        if (this._Q < this._A) throw ("error:004");
        var _t = (this._Q - this._A) / this._e;
        if (_I(_t) != _t) throw ("error:005");
        if ((typeof this._i != _lsl)) throw ("error:006");
      } else if (this._k == 1) {
        if ((typeof this._A != _p) || (typeof this._Q != _p)) {
          throw ("error:001");
        }
        if (typeof this._e != _p || this._e > _Q) throw ("error:002");
        if (this._Q < this._A) throw ("error:004");
        var _t = (this._Q - this._A) / this._e;
        if (_I(_t) != _t) throw ("error:005");
        if ((typeof this._i != _lsl)) throw ("error:006");
        var aG = _S(_wei(_S(this._e)));
        var _Re = 0;
        var _h = true;
        if (aG.indexOf("+") == -1) {
          for (var _x = this._A; _x <= this._Q; _x += _F(this._e)) {
            _x = _F(_x);
            (_x != 0) ? _x = _x.toFixed(aG): _x = _I(_x);
            if (typeof this._i[_S(_x)] != _p) {
              _h = false
            } else {
              _Re = _Re + this._i[_S(_x)]
            }
            _x = _F(_x)
          }
        } else {
          for (var _x = this._A; _x <= this._Q; _x += _I(this._e)) {
            if (typeof this._i[_x] != _p) {
              _h = false
            } else {
              _Re = _Re + this._i[_S(_x)]
            }
            _x = _I(_x)
          }
        }
        var _di = _Re - 1;
        _di = (_di >= 0) ? _di : -_di;
        _h = (_di < 0.1) ? _h : false;
        if (!_h) throw ("error:007");
      } else if (this._k == 2) {
        if ((typeof this._i != _lsl)) throw ("error:006");
        var _Re = 0;
        var _h = true;
        for (var n in this._i) {
          if (typeof this._i[n] != _p) {
            _h = false
          } else {
            _Re = _Re + this._i[n]
          }
        }
        var _di = _Re - 1;
        _di = (_di >= 0) ? _di : -_di;
        _h = (_di < 0.1) ? _h : false;
        if (!_h) throw ("error:008");
      } else {
        throw ("error:003.");
      }
    };
    switch (arguments.length) {
      case 0:
        var _A = 0,
          _Q = 1,
          _e = 0.1,
          _k = 0,
          _i = {};
        this._A = _A;
        this._Q = _Q;
        this._e = _e;
        this._k = _k;
        this._i = _i;
        break;
      case 1:
        this._A = _A;
        var _Q = this._A + 1,
          _e = 1,
          _k = 0,
          _i = {};
        this._Q = _Q;
        this._e = _e;
        this._k = _k;
        this._i = _i;
        break;
      case 2:
        this._A = _A;
        this._Q = _Q;
        var _e = 1,
          _k = 0,
          _i = {};
        this._e = _e;
        this._k = _k;
        this._i = _i;
        break;
      case 3:
        this._A = _A;
        this._Q = _Q;
        this._e = _e;
        var _k = 0,
          _i = {};
        this._k = _k;
        this._i = _i;
        break;
      case 4:
        this._A = _A;
        this._Q = _Q;
        this._e = _e;
        this._k = _k;
        var _i = {};
        this._i = _i;
        break;
      case 5:
        this._A = _A;
        this._Q = _Q;
        this._e = _e;
        this._k = _k;
        this._i = _i;
        break
    }
    _ee();
    var aG = _S(_wei(_S(this._e)));
    if (this._k == 0) {
      aG = _S(aG);
      if (aG.indexOf("+") == -1) {
        aG = _I(aG);
        var aF = (1 / ((this._Q - this._A) / this._e + 1)).toFixed(_I(aG + 10));
        for (var _x = this._A; _x <= this._Q; _x += _F(this._e)) {
          if (_x != 0) {
            _x = _x.toFixed(aG)
          }
          this._i[_S(_x)] = _S(aF);
          _x = _F(_x)
        }
      } else {
        aG = 1;
        var aF = (1 / ((this._Q - this._A) / this._e + 1)).toFixed(_I(aG + 10));
        for (var _x = this._A; _x <= this._Q; _x += _I(this._e)) {
          this._i[_S(_x)] = _S(aF);
          _x = _I(_x)
        }
        aG = "+1";
      }
    }
    if (this._k != 2) {
      aG = _S(aG);
      if (aG.indexOf("+") == -1) {
        aG = _I(aG);
        var _pl = new Array();
        var _z = 0;
        _pl[(this._A).toFixed(aG)] = this._i[(this._A).toFixed(aG)];
        for (var _x = this._A + this._e; _x <= this._Q; _x += _F(this._e)) {
          _x = _F(_x);
          _z = _F(_z);
          (_x != 0) ? _x = _x.toFixed(aG): _x = _x;
          _z = _x - this._e;
          (_z != 0) ? _z = _z.toFixed(aG): _z = _z;
          _pl[_S(_x)] = _F(_pl[_S(_z)]) + _F(this._i[_S(_x)]);
          _x = _F(_x)
        }
        _x = _F(_F(_z) + _F(this._e));
        (_x != 0) ? _x = _x.toFixed(aG): _x = _x;
        _pl[_S(_x)] = 1;
        var aH = Math.random();
        for (var aQ in _pl) {
          if (aH <= _pl[_S(aQ)]) return aQ
        }
      } else {
        aG = 1;
        var _pl = new Array();
        var _z = 0;
        _pl[this._A] = this._i[this._A];
        for (var _x = this._A + this._e; _x <= this._Q; _x += _I(this._e)) {
          _z = _x - this._e;
          _x = _I(_x);
          _z = _I(_z);
          _pl[_S(_x)] = _F(_pl[_S(_z)]) + _F(this._i[_S(_x)]);
          _x = _I(_x)
        }
        _x = _I(_I(_z) + _I(this._e));
        _pl[_S(_x)] = 1;
        var aH = Math.random();
        for (var aQ in _pl) {
          if (aH <= _pl[_S(aQ)]) return _S(aQ)
        }
      }
    }
    if (this._k == 2) {
      var _r = {};
      var _ke = {};
      var _lp = 0;
      for (var nn in _i) {
        _lp++;
        _ke[_S(_lp)] = nn;
        _r[_S(_lp)] = _i[nn]
      }
      var _lQ = yiRan(1, _lp, 1, 1, _r);
      return _ke[_lQ]
    }
  }
})(parseInt, parseFloat, String);
module.exports = this;