var colorPicker = (function() {
  var colors = ["#f34d23ff", "#fff153ff", "#b747d5ff", "#0ccd70ff"];
  var index = 0;
  function next() {
    index = index++ < colors.length-1 ? index : 0;
    return colors[index];
  }
  function current() {
    return colors[index]
  }
  return {
    next: next,
    current: current
  }
})();

function extend(a, b){
  for(var key in b) {
    if(b.hasOwnProperty(key)) {
      a[key] = b[key];
    }
  }
  return a;
}

var Circle = function(opts) {
  extend(this, opts);
}

var S = {
  init: function () {
    S.Drawing.init('.canvas');
    document.body.classList.add('body--ready');

    // Load saved names or show default
    const savedNames = localStorage.getItem('standupNames');
    if (savedNames) {
      document.getElementById('names-input').value = savedNames;
    }

    S.UI.init();

    S.Drawing.loop(function () {
      S.Shape.render();
    });
  }
};


S.Drawing = (function () {
  var canvas,
      context,
      renderFn
      requestFrame = window.requestAnimationFrame       ||
                     window.webkitRequestAnimationFrame ||
                     window.mozRequestAnimationFrame    ||
                     window.oRequestAnimationFrame      ||
                     window.msRequestAnimationFrame     ||
                     function(callback) {
                       window.setTimeout(callback, 1000 / 60);
                     };

  return {
    init: function (el) {
      canvas = document.querySelector(el);
      context = canvas.getContext('2d');
      this.adjustCanvas();

      window.addEventListener('resize', function (e) {
        S.Drawing.adjustCanvas();
      });
    },

    loop: function (fn) {
      renderFn = !renderFn ? fn : renderFn;
      this.clearFrame();
      renderFn();
      requestFrame.call(window, this.loop.bind(this));
    },

    adjustCanvas: function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    },

    clearFrame: function () {
      context.clearRect(0, 0, canvas.width, canvas.height);
    },

    getArea: function () {
      return { w: canvas.width, h: canvas.height };
    },

    drawCircle: function (p, c) {
      context.fillStyle = c.render();
      context.beginPath();
      context.arc(p.x, p.y, p.z, 0, 2 * Math.PI, true);
      context.closePath();
      context.fill();
    }
  }
}());


S.UI = (function () {
  var help = document.querySelector('.help'),
      overlay = document.querySelector('.overlay'),
      canvas = document.querySelector('.canvas'),
      namesInput = document.getElementById('names-input'),
      saveButton = document.getElementById('save-names'),
      pickButton = document.getElementById('pick-button'),
      interval,
      currentAction,
      sequence = [],
      teamNames = [],
      isAnimating = false,
      fireworkAnimations = [];

  function reset(destroy) {
    clearInterval(interval);
    sequence = [];
    destroy && S.Shape.switchShape(S.ShapeBuilder.letter(''));
  }

  function removeFireworkAnimation(animation) {
    var index = fireworkAnimations.indexOf(animation);
    if (index > -1) fireworkAnimations.splice(index, 1);
  }

  function triggerFireworks() {
    var context = canvas.getContext('2d');
    Circle.prototype.draw = function() {
        context.globalAlpha = this.opacity || 1;
        context.beginPath();
        context.arc(this.x, this.y, this.r, 0, 2 * Math.PI, false);
        if (this.stroke) {
            context.strokeStyle = this.stroke.color;
            context.lineWidth = this.stroke.width;
            context.stroke();
        }
        if (this.fill) {
            context.fillStyle = this.fill;
            context.fill();
        }
        context.closePath();
        context.globalAlpha = 1;
    }

    var particles = [];
    for (var i=0; i<32; i++) {
    var area = S.Drawing.getArea();
    var particle = new Circle({
      x: Math.random() * area.w,
      y: Math.random() * area.h,
      fill: colorPicker.next(),
      r: anime.random(24, 48)
    })
      particles.push(particle);
    }
    var rippleSize = Math.min(200, (area.w * .4));
    var particlesAnimation = anime({
      targets: particles,
      x: function(particle){
        return particle.x + anime.random(rippleSize, -rippleSize);
      },
      y: function(particle){
        return particle.y + anime.random(rippleSize * 1.15, -rippleSize * 1.15);
      },
      r: 0,
      easing: "easeOutExpo",
      duration: anime.random(1000,1300),
      complete: removeFireworkAnimation
    });
    fireworkAnimations.push(particlesAnimation);

    anime({
      duration: Infinity,
      update: function() {
        fireworkAnimations.forEach(function(anim) {
          anim.animatables.forEach(function(animatable) {
            animatable.target.draw();
          });
        });
      }
    });
  }

  function performStandupSelection() {
    if (isAnimating || teamNames.length === 0) return;
    
    isAnimating = true;
    pickButton.disabled = true;
    overlay.classList.remove('overlay--visible');
    
    // Build sequence: cycle through names with "It's not you", then final name with "It's you!"
    sequence = [];
    const cycleTimes = 2; // Cycle through all names twice
    const selectedIndex = Math.floor(Math.random() * teamNames.length);
    
    // Add cycling through names
    for (let cycle = 0; cycle < cycleTimes; cycle++) {
      for (let i = 0; i < teamNames.length; i++) {
        sequence.push({ name: teamNames[i], isWinner: false });
      }
    }
    
    // Add final names leading to winner
    for (let i = 0; i < teamNames.length; i++) {
      const isWinner = i === selectedIndex;
      sequence.push({ name: teamNames[i], isWinner: isWinner });
      if (isWinner) break;
    }
    
    let index = 0;
    let delay = 700; // Start slow
    
    function showNext() {
      if (index >= sequence.length) {
        isAnimating = false;
        pickButton.disabled = false;
        return;
      }
      
      const current = sequence[index];
      const message = current.isWinner ? `${current.name} it's you!` : "Is it you?";
      
      // Show name
      S.Shape.switchShape(S.ShapeBuilder.letter(current.name), true);
      
      setTimeout(function() {
        // Show verdict
        S.Shape.switchShape(S.ShapeBuilder.letter(message), true);
        
        // Calculate delay - speed up as we go
        const progress = index / sequence.length;
        if (current.isWinner) {
          delay = 2000; // Pause on winner
          var cheer = document.getElementById("cheer-audio");
          cheer.play();
          for (let i = 0; i < 10; i++) {
            setTimeout(() => triggerFireworks(), i * 300);
          }
        } else if (progress > 0.7) {
          delay = 300 + (sequence.length - index - 1) * 50; // Slow down near end
        } else {
          delay = Math.max(500, 1000 - (index * 20)); // Speed up
        }
        
        index++;
        setTimeout(showNext, delay);
      }, current.isWinner ? 1000 : 600);
    }
    
    showNext();
  }

  function saveTeamNames() {
    const names = namesInput.value
      .split('\n')
      .map(n => n.trim())
      .filter(n => n);
    
    if (names.length === 0) {
      alert('Please enter at least one name');
      return;
    }
    
    teamNames = names;
    localStorage.setItem('standupNames', namesInput.value);
    overlay.classList.remove('overlay--visible');
    S.Shape.switchShape(S.ShapeBuilder.letter('Ready!'));
  }

  function bindEvents() {
    help.addEventListener('click', function (e) {
      overlay.classList.toggle('overlay--visible');
      overlay.classList.contains('overlay--visible') && reset(true);
    });

    saveButton.addEventListener('click', saveTeamNames);
    
    pickButton.addEventListener('click', function() {
      if (teamNames.length === 0) {
        alert('Please add team members first (click the ? button)');
        overlay.classList.add('overlay--visible');
        return;
      }
      performStandupSelection();
    });

    canvas.addEventListener('click', function (e) {
      overlay.classList.remove('overlay--visible');
    });
    
    // Enter key in textarea saves
    namesInput.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'Enter') {
        saveTeamNames();
      }
    });
  }

  function init() {
    bindEvents();
    
    // Load saved names
    const savedNames = localStorage.getItem('standupNames');
    if (savedNames) {
      teamNames = savedNames.split('\n').map(n => n.trim()).filter(n => n);
      S.Shape.switchShape(S.ShapeBuilder.letter('Ready!'));
    } else {
      S.Shape.switchShape(S.ShapeBuilder.letter('Click ? to add team'));
    }
  }

  return {
    init: init,
    simulate: function (action) {
      // Legacy support
    }
  }
}());



S.Point = function (args) {
  this.x = args.x;
  this.y = args.y;
  this.z = args.z;
  this.a = args.a;
  this.h = args.h;
};


S.Color = function (r, g, b, a) {
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
};

S.Color.prototype = {
  render: function () {
    return 'rgba(' + this.r + ',' +  + this.g + ',' + this.b + ',' + this.a + ')';
  }
};


S.Dot = function (x, y) {
  this.p = new S.Point({
    x: x,
    y: y,
    z: 5,
    a: 1,
    h: 0
  });

  this.e = 0.07;
  this.s = true;

  this.c = new S.Color(255, 255, 255, this.p.a);

  this.t = this.clone();
  this.q = [];
};

S.Dot.prototype = {
  clone: function () {
    return new S.Point({
      x: this.x,
      y: this.y,
      z: this.z,
      a: this.a,
      h: this.h
    });
  },

  _draw: function () {
    this.c.a = this.p.a;
    S.Drawing.drawCircle(this.p, this.c);
  },

  _moveTowards: function (n) {
    var details = this.distanceTo(n, true),
        dx = details[0],
        dy = details[1],
        d = details[2],
        e = this.e * d;

    if (this.p.h === -1) {
      this.p.x = n.x;
      this.p.y = n.y;
      return true;
    }

    if (d > 1) {
      this.p.x -= ((dx / d) * e);
      this.p.y -= ((dy / d) * e);
    } else {
      if (this.p.h > 0) {
        this.p.h--;
      } else {
        return true;
      }
    }

    return false;
  },

  _update: function () {
    if (this._moveTowards(this.t)) {
      var p = this.q.shift();

      if (p) {
        this.t.x = p.x || this.p.x;
        this.t.y = p.y || this.p.y;
        this.t.z = p.z || this.p.z;
        this.t.a = p.a || this.p.a;
        this.p.h = p.h || 0;
      } else {
        if (this.s) {
          this.p.x -= Math.sin(Math.random() * 3.142);
          this.p.y -= Math.sin(Math.random() * 3.142);
        } else {
          this.move(new S.Point({
            x: this.p.x + (Math.random() * 50) - 25,
            y: this.p.y + (Math.random() * 50) - 25,
          }));
        }
      }
    }

    d = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - (d * 0.05));
    d = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - (d * 0.05));
  },

  distanceTo: function (n, details) {
    var dx = this.p.x - n.x,
        dy = this.p.y - n.y,
        d = Math.sqrt(dx * dx + dy * dy);

    return details ? [dx, dy, d] : d;
  },

  move: function (p, avoidStatic) {
    if (!avoidStatic || (avoidStatic && this.distanceTo(p) > 1)) {
      this.q.push(p);
    }
  },

  render: function () {
    this._update();
    this._draw();
  }
}


S.ShapeBuilder = (function () {
  var gap = 13,
      shapeCanvas = document.createElement('canvas'),
      shapeContext = shapeCanvas.getContext('2d'),
      fontSize = 500,
      fontFamily = 'Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';

  function fit() {
    shapeCanvas.width = Math.floor(window.innerWidth / gap) * gap;
    shapeCanvas.height = Math.floor(window.innerHeight / gap) * gap;
    shapeContext.fillStyle = 'red';
    shapeContext.textBaseline = 'middle';
    shapeContext.textAlign = 'center';
  }

  function processCanvas() {
    var pixels = shapeContext.getImageData(0, 0, shapeCanvas.width, shapeCanvas.height).data;
        dots = [],
        pixels,
        x = 0,
        y = 0,
        fx = shapeCanvas.width,
        fy = shapeCanvas.height,
        w = 0,
        h = 0;

    for (var p = 0; p < pixels.length; p += (4 * gap)) {
      if (pixels[p + 3] > 0) {
        dots.push(new S.Point({
          x: x,
          y: y
        }));

        w = x > w ? x : w;
        h = y > h ? y : h;
        fx = x < fx ? x : fx;
        fy = y < fy ? y : fy;
      }

      x += gap;

      if (x >= shapeCanvas.width) {
        x = 0;
        y += gap;
        p += gap * 4 * shapeCanvas.width;
      }
    }

    return { dots: dots, w: w + fx, h: h + fy };
  }

  function setFontSize(s) {
    shapeContext.font = 'bold ' + s + 'px ' + fontFamily;
  }

  function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function init() {
    fit();
    window.addEventListener('resize', fit);
  }

  // Init
  init();

  return {
    imageFile: function (url, callback) {
      var image = new Image(),
          a = S.Drawing.getArea();

      image.onload = function () {
        shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
        shapeContext.drawImage(this, 0, 0, a.h * 0.6, a.h * 0.6);
        callback(processCanvas());
      };

      image.onerror = function () {
        callback(S.ShapeBuilder.letter('What?'));
      }

      image.src = url;
    },

    circle: function (d) {
      var r = Math.max(0, d) / 2;
      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.beginPath();
      shapeContext.arc(r * gap, r * gap, r * gap, 0, 2 * Math.PI, false);
      shapeContext.fill();
      shapeContext.closePath();

      return processCanvas();
    },

    letter: function (l) {
      var s = 0;

      setFontSize(fontSize);
      s = Math.min(fontSize,
                  (shapeCanvas.width / shapeContext.measureText(l).width) * 0.8 * fontSize, 
                  (shapeCanvas.height / fontSize) * (isNumber(l) ? 1 : 0.45) * fontSize);
      setFontSize(s);

      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.fillText(l, shapeCanvas.width / 2, shapeCanvas.height / 2);

      return processCanvas();
    },

    rectangle: function (w, h) {
      var dots = [],
          width = gap * w,
          height = gap * h;

      for (var y = 0; y < height; y += gap) {
        for (var x = 0; x < width; x += gap) {
          dots.push(new S.Point({
            x: x,
            y: y,
          }));
        }
      }

      return { dots: dots, w: width, h: height };
    }
  };
}());


S.Shape = (function () {
  var dots = [],
      width = 0,
      height = 0,
      cx = 0,
      cy = 0;

  function compensate() {
    var a = S.Drawing.getArea();

    cx = a.w / 2 - width / 2;
    cy = a.h / 2 - height / 2;
  }

  return {
    shuffleIdle: function () {
      var a = S.Drawing.getArea();

      for (var d = 0; d < dots.length; d++) {
        if (!dots[d].s) {
          dots[d].move({
            x: Math.random() * a.w,
            y: Math.random() * a.h
          });
        }
      }
    },

    switchShape: function (n, fast) {
      var size,
          a = S.Drawing.getArea();

      width = n.w;
      height = n.h;

      compensate();

      if (n.dots.length > dots.length) {
        size = n.dots.length - dots.length;
        for (var d = 1; d <= size; d++) {
          dots.push(new S.Dot(a.w / 2, a.h / 2));
        }
      }

      var d = 0,
          i = 0;

      while (n.dots.length > 0) {
        i = Math.floor(Math.random() * n.dots.length);
        dots[d].e = fast ? 0.25 : (dots[d].s ? 0.14 : 0.11);

        if (dots[d].s) {
          dots[d].move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 18
          }));
        } else {
          dots[d].move(new S.Point({
            z: Math.random() * 5 + 5,
            h: fast ? 18 : 30
          }));
        }

        dots[d].s = true;
        dots[d].move(new S.Point({
          x: n.dots[i].x + cx,
          y: n.dots[i].y + cy,
          a: 1,
          z: 5,
          h: 0
        }));

        n.dots = n.dots.slice(0, i).concat(n.dots.slice(i + 1));
        d++;
      }

      for (var i = d; i < dots.length; i++) {
        if (dots[i].s) {
          dots[i].move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 20
          }));

          dots[i].s = false;
          dots[i].e = 0.04;
          dots[i].move(new S.Point({ 
            x: Math.random() * a.w,
            y: Math.random() * a.h,
            a: 0.3, //.4
            z: Math.random() * 4,
            h: 0
          }));
        }
      }
    },

    render: function () {
      for (var d = 0; d < dots.length; d++) {
        dots[d].render();
      }
    }
  }
}());

S.init();
