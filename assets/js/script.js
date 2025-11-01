'use strict';

const colorPicker = (() => {
  const colors = ['#f34d23ff', '#fff153ff', '#b747d5ff', '#0ccd70ff'];
  let index = 0;

  const next = () => {
    index = (index + 1) % colors.length;
    return colors[index];
  };

  const current = () => colors[index];

  return { next, current };
})();

class Circle {
  constructor(options = {}) {
    Object.assign(this, options);
  }
}

const createCircleRenderer = context => function drawCircleParticle() {
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
};

const S = {
  init() {
    S.Drawing.init('.canvas');
    document.body.classList.add('body--ready');

    const savedNames = localStorage.getItem('standupNames');
    if (savedNames) {
      document.getElementById('names-input').value = savedNames;
    }

    S.UI.init();

    S.Drawing.loop(() => {
      S.Shape.render();
    });
  }
};

S.Drawing = (() => {
  let canvas = null;
  let context = null;
  let renderFn = null;

  const requestFrame = window.requestAnimationFrame ||
                       window.webkitRequestAnimationFrame ||
                       window.mozRequestAnimationFrame ||
                       window.oRequestAnimationFrame ||
                       window.msRequestAnimationFrame ||
                       (callback => window.setTimeout(callback, 1000 / 60));

  const adjustCanvas = () => {
    if (!canvas) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  const clearFrame = () => {
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startLoop = fn => {
    if (!renderFn) {
      renderFn = fn;
    }

    clearFrame();
    renderFn();
    requestFrame(() => startLoop(renderFn));
  };

  return {
    init(selector) {
      canvas = document.querySelector(selector);
      context = canvas.getContext('2d');
      adjustCanvas();

      window.addEventListener('resize', adjustCanvas);
    },

    loop(fn) {
      startLoop(fn);
    },

    adjustCanvas,

    clearFrame,

    getArea() {
      return { w: canvas.width, h: canvas.height };
    },

    drawCircle(point, color) {
      context.fillStyle = color.render();
      context.beginPath();
      context.arc(point.x, point.y, point.z, 0, 2 * Math.PI, true);
      context.closePath();
      context.fill();
    }
  };
})();

S.UI = (() => {
  const help = document.querySelector('.help');
  const overlay = document.querySelector('.overlay');
  const canvas = document.querySelector('.canvas');
  const namesInput = document.getElementById('names-input');
  const saveButton = document.getElementById('save-names');
  const pickButton = document.getElementById('pick-button');

  let sequence = [];
  let teamNames = [];
  let isAnimating = false;
  let fireworkAnimations = [];
  let selectionRunId = 0;

  const incrementRun = () => {
    selectionRunId += 1;
  };

  const reset = destroy => {
    incrementRun();
    sequence = [];
    isAnimating = false;
    pickButton.disabled = false;

    if (destroy) {
      S.Shape.switchShape(S.ShapeBuilder.letter(''));
    }
  };

  const removeFireworkAnimation = animation => {
    const index = fireworkAnimations.indexOf(animation);
    if (index !== -1) {
      fireworkAnimations.splice(index, 1);
    }
  };

  const triggerFireworks = () => {
    const context = canvas.getContext('2d');
    const drawParticle = createCircleRenderer(context);
    const area = S.Drawing.getArea();

    const particles = Array.from({ length: 32 }, () => {
      const particle = new Circle({
        x: Math.random() * area.w,
        y: Math.random() * area.h,
        fill: colorPicker.next(),
        r: anime.random(24, 48)
      });

      particle.draw = drawParticle;
      return particle;
    });

    const rippleSize = Math.min(200, area.w * 0.4);
    const particlesAnimation = anime({
      targets: particles,
      x(particle) {
        return particle.x + anime.random(rippleSize, -rippleSize);
      },
      y(particle) {
        return particle.y + anime.random(rippleSize * 1.15, -rippleSize * 1.15);
      },
      r: 0,
      easing: 'easeOutExpo',
      duration: anime.random(800, 1100),
      complete: animation => removeFireworkAnimation(animation)
    });

    fireworkAnimations.push(particlesAnimation);

    anime({
      duration: Infinity,
      update() {
        fireworkAnimations.forEach(animation => {
          animation.animatables.forEach(animatable => {
            animatable.target.draw();
          });
        });
      }
    });
  };

  const wait = duration => new Promise(resolve => {
    setTimeout(resolve, duration);
  });

  const waitForShapeToSettle = (runId, timeout = 1550) => new Promise(resolve => {
    const start = performance.now();

    const check = () => {
      if (runId !== selectionRunId) {
        resolve();
        return;
      }

      const elapsed = performance.now() - start;
      if (S.Shape.isSettled() || elapsed >= timeout) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };

    requestAnimationFrame(check);
  });

  const performStandupSelection = () => {
    if (isAnimating || teamNames.length === 0) {
      return;
    }

    incrementRun();
    const runId = selectionRunId;

    isAnimating = true;
    pickButton.disabled = true;
    overlay.classList.remove('overlay--visible');

    sequence = [];
    const cycleTimes = 1;
    const selectedIndex = Math.floor(Math.random() * teamNames.length);

    for (let cycle = 0; cycle < cycleTimes; cycle += 1) {
      teamNames.forEach(name => {
        sequence.push({ name, isWinner: false });
      });
    }

    for (let i = 0; i < teamNames.length; i += 1) {
      const isWinner = i === selectedIndex;
      sequence.push({ name: teamNames[i], isWinner });
      if (isWinner) {
        break;
      }
    }

    let index = 0;

    const showNext = async () => {
      if (runId !== selectionRunId) {
        return;
      }

      if (index >= sequence.length) {
        isAnimating = false;
        pickButton.disabled = false;
        return;
      }

      const current = sequence[index];
      const message = current.isWinner ? `${current.name} it's you!` : 'Is it you?';

      S.Shape.switchShape(S.ShapeBuilder.letter(current.name), true);
      await waitForShapeToSettle(runId);
      if (runId !== selectionRunId) {
        return;
      }

      await wait(current.isWinner ? 800 : 400);
      if (runId !== selectionRunId) {
        return;
      }

      S.Shape.switchShape(S.ShapeBuilder.letter(message), true);
      await waitForShapeToSettle(runId);
      if (runId !== selectionRunId) {
        return;
      }

      const progress = index / sequence.length;
      let delay;

      if (current.isWinner) {
        delay = 2000;
        const cheer = document.getElementById('cheer-audio');
        if (cheer) {
          cheer.currentTime = 0;
          cheer.play();
        }

        for (let i = 0; i < 10; i += 1) {
          setTimeout(() => {
            if (runId === selectionRunId) {
              triggerFireworks();
            }
          }, i * 300);
        }
      } else if (progress > 0.7) {
        delay = 300 + (sequence.length - index - 1) * 50;
      } else {
        delay = Math.max(400, 900 - index * 20);
      }

      index += 1;

      await wait(delay);
      if (runId !== selectionRunId) {
        return;
      }

      showNext();
    };

    showNext();
  };

  const saveTeamNames = () => {
    const names = namesInput.value
      .split('\n')
      .map(name => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      alert('Please enter at least one name');
      return;
    }

    teamNames = names;
    localStorage.setItem('standupNames', namesInput.value);
    overlay.classList.remove('overlay--visible');
    S.Shape.switchShape(S.ShapeBuilder.letter('Ready!'));
  };

  const bindEvents = () => {
    help.addEventListener('click', () => {
      overlay.classList.toggle('overlay--visible');
      if (overlay.classList.contains('overlay--visible')) {
        reset(true);
      }
    });

    saveButton.addEventListener('click', saveTeamNames);

    pickButton.addEventListener('click', () => {
      if (teamNames.length === 0) {
        alert('Please add team members first (click the ? button)');
        overlay.classList.add('overlay--visible');
        return;
      }

      performStandupSelection();
    });

    canvas.addEventListener('click', () => {
      overlay.classList.remove('overlay--visible');
    });

    namesInput.addEventListener('keydown', event => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        saveTeamNames();
      }
    });
  };

  const init = () => {
    bindEvents();

    const savedNames = localStorage.getItem('standupNames');
    if (savedNames) {
      teamNames = savedNames.split('\n').map(name => name.trim()).filter(Boolean);
      S.Shape.switchShape(S.ShapeBuilder.letter('Ready!'));
    } else {
      S.Shape.switchShape(S.ShapeBuilder.letter('Click ? to add team'));
    }
  };

  return {
    init,
    simulate() {
      // Legacy support placeholder.
    }
  };
})();

class Point {
  constructor({ x, y, z = 0, a = 1, h = 0 }) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.a = a;
    this.h = h;
  }
}

S.Point = Point;

class Color {
  constructor(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  render() {
    return `rgba(${this.r},${this.g},${this.b},${this.a})`;
  }
}

S.Color = Color;

class Dot {
  constructor(x, y) {
    this.p = new S.Point({
      x,
      y,
      z: 5,
      a: 1,
      h: 0
    });

    this.e = 0.07;
    this.s = true;
    this.c = new S.Color(255, 255, 255, this.p.a);
    this.t = this.clone();
    this.q = [];
  }

  clone() {
    return new S.Point({
      x: this.p.x,
      y: this.p.y,
      z: this.p.z,
      a: this.p.a,
      h: this.p.h
    });
  }

  _draw() {
    this.c.a = this.p.a;
    S.Drawing.drawCircle(this.p, this.c);
  }

  _moveTowards(target) {
    const [dx, dy, distance] = this.distanceTo(target, true);
    const easing = this.e * distance;

    if (this.p.h === -1) {
      this.p.x = target.x;
      this.p.y = target.y;
      return true;
    }

    if (distance > 1) {
      this.p.x -= (dx / distance) * easing;
      this.p.y -= (dy / distance) * easing;
    } else if (this.p.h > 0) {
      this.p.h -= 1;
    } else {
      return true;
    }

    return false;
  }

  _update() {
    if (this._moveTowards(this.t)) {
      const nextPoint = this.q.shift();

      if (nextPoint) {
        this.t.x = nextPoint.x || this.p.x;
        this.t.y = nextPoint.y || this.p.y;
        this.t.z = nextPoint.z || this.p.z;
        this.t.a = nextPoint.a || this.p.a;
        this.p.h = nextPoint.h || 0;
      } else if (this.s) {
        this.p.x -= Math.sin(Math.random() * Math.PI);
        this.p.y -= Math.sin(Math.random() * Math.PI);
      } else {
        this.move(new S.Point({
          x: this.p.x + Math.random() * 50 - 25,
          y: this.p.y + Math.random() * 50 - 25
        }));
      }
    }

    const alphaDelta = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - alphaDelta * 0.05);

    const depthDelta = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - depthDelta * 0.05);
  }

  distanceTo(point, details) {
    const dx = this.p.x - point.x;
    const dy = this.p.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return details ? [dx, dy, distance] : distance;
  }

  move(point, avoidStatic) {
    if (!avoidStatic || (avoidStatic && this.distanceTo(point) > 1)) {
      this.q.push(point);
    }
  }

  render() {
    this._update();
    this._draw();
  }

  isSettled(threshold = 1.2) {
    const positionSettled = this.distanceTo(this.t) <= threshold;
    const alphaSettled = Math.abs(this.p.a - this.t.a) <= 0.05;
    const depthSettled = Math.abs(this.p.z - this.t.z) <= 0.5;
    return positionSettled && alphaSettled && depthSettled && this.q.length === 0 && this.p.h === 0;
  }
}

S.Dot = Dot;

S.ShapeBuilder = (() => {
  const gap = 13;
  const shapeCanvas = document.createElement('canvas');
  const shapeContext = shapeCanvas.getContext('2d');
  const fontSize = 500;
  const fontFamily = 'Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';

  const fit = () => {
    shapeCanvas.width = Math.floor(window.innerWidth / gap) * gap;
    shapeCanvas.height = Math.floor(window.innerHeight / gap) * gap;
    shapeContext.fillStyle = 'red';
    shapeContext.textBaseline = 'middle';
    shapeContext.textAlign = 'center';
  };

  const processCanvas = () => {
    const imageData = shapeContext.getImageData(0, 0, shapeCanvas.width, shapeCanvas.height).data;
    const dots = [];

    let x = 0;
    let y = 0;
    let fx = shapeCanvas.width;
    let fy = shapeCanvas.height;
    let w = 0;
    let h = 0;

    for (let p = 0; p < imageData.length; p += 4 * gap) {
      if (imageData[p + 3] > 0) {
        dots.push(new S.Point({ x, y }));
        w = Math.max(w, x);
        h = Math.max(h, y);
        fx = Math.min(fx, x);
        fy = Math.min(fy, y);
      }

      x += gap;

      if (x >= shapeCanvas.width) {
        x = 0;
        y += gap;
        p += gap * 4 * shapeCanvas.width;
      }
    }

    return { dots, w: w + fx, h: h + fy };
  };

  const setFontSize = size => {
    shapeContext.font = `bold ${size}px ${fontFamily}`;
  };

  const isNumber = value => !Number.isNaN(parseFloat(value)) && Number.isFinite(Number(value));

  const init = () => {
    fit();
    window.addEventListener('resize', fit);
  };

  init();

  return {
    imageFile(url, callback) {
      const image = new Image();
      const area = S.Drawing.getArea();

      image.onload = function onLoad() {
        shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
        const scaledSize = area.h * 0.6;
        shapeContext.drawImage(this, 0, 0, scaledSize, scaledSize);
        callback(processCanvas());
      };

      image.onerror = () => {
        callback(S.ShapeBuilder.letter('What?'));
      };

      image.src = url;
    },

    circle(diameter) {
      const radius = Math.max(0, diameter) / 2;
      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.beginPath();
      shapeContext.arc(radius * gap, radius * gap, radius * gap, 0, 2 * Math.PI, false);
      shapeContext.fill();
      shapeContext.closePath();

      return processCanvas();
    },

    letter(letter) {
      let size = fontSize;
      const text = letter || '';

      setFontSize(fontSize);
      const measuredWidth = Math.max(shapeContext.measureText(text).width, 1);

      size = Math.min(
        fontSize,
        (shapeCanvas.width / measuredWidth) * 0.8 * fontSize,
        (shapeCanvas.height / fontSize) * (isNumber(text) ? 1 : 0.45) * fontSize
      );
      setFontSize(size);

      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.fillText(text, shapeCanvas.width / 2, shapeCanvas.height / 2);

      return processCanvas();
    },

    rectangle(width, height) {
      const dots = [];
      const scaledWidth = gap * width;
      const scaledHeight = gap * height;

      for (let y = 0; y < scaledHeight; y += gap) {
        for (let x = 0; x < scaledWidth; x += gap) {
          dots.push(new S.Point({ x, y }));
        }
      }

      return { dots, w: scaledWidth, h: scaledHeight };
    }
  };
})();

S.Shape = (() => {
  const dots = [];
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;

  const compensate = () => {
    const area = S.Drawing.getArea();
    cx = area.w / 2 - width / 2;
    cy = area.h / 2 - height / 2;
  };

  return {
    shuffleIdle() {
      const area = S.Drawing.getArea();

      for (let d = 0; d < dots.length; d += 1) {
        if (!dots[d].s) {
          dots[d].move({
            x: Math.random() * area.w,
            y: Math.random() * area.h
          });
        }
      }
    },

    switchShape(shape, fast) {
      if (!shape || !Array.isArray(shape.dots)) {
        return;
      }

      const area = S.Drawing.getArea();
      width = shape.w || 0;
      height = shape.h || 0;

      compensate();

      if (shape.dots.length > dots.length) {
        const additionalDots = shape.dots.length - dots.length;
        for (let d = 0; d < additionalDots; d += 1) {
          dots.push(new S.Dot(area.w / 2, area.h / 2));
        }
      }

      const availableDots = shape.dots.slice();
      let d = 0;

      while (availableDots.length > 0 && d < dots.length) {
        const index = Math.floor(Math.random() * availableDots.length);
        const target = availableDots.splice(index, 1)[0];
        const dot = dots[d];

        dot.e = fast ? 0.25 : (dot.s ? 0.14 : 0.11);

        if (dot.s) {
          dot.move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 18
          }));
        } else {
          dot.move(new S.Point({
            z: Math.random() * 5 + 5,
            h: fast ? 18 : 30
          }));
        }

        dot.s = true;
        dot.move(new S.Point({
          x: target.x + cx,
          y: target.y + cy,
          a: 1,
          z: 5,
          h: 0
        }));

        d += 1;
      }

      for (let i = d; i < dots.length; i += 1) {
        const dot = dots[i];
        if (dot.s) {
          dot.move(new S.Point({
            z: Math.random() * 20 + 10,
            a: Math.random(),
            h: 20
          }));

          dot.s = false;
          dot.e = 0.04;
          dot.move(new S.Point({
            x: Math.random() * area.w,
            y: Math.random() * area.h,
            a: 0.3,
            z: Math.random() * 4,
            h: 0
          }));
        }
      }
    },

    render() {
      for (let d = 0; d < dots.length; d += 1) {
        dots[d].render();
      }
    },

    isSettled(threshold = 1.2) {
      if (dots.length === 0) {
        return true;
      }

      for (let i = 0; i < dots.length; i += 1) {
        if (!dots[i].isSettled(threshold)) {
          return false;
        }
      }

      return true;
    }
  };
})();

S.init();
