// create an SVG string for a segment that would go into a `<path d="..." />`.
const createBeizerSVGPath = (p1, p2, ratio) => {
  const bezier_distance = 500;
  ratio *= 0.5;
  return `L ${p1.x * 1000},${p1.y * 1000} C ${p1.x * 1000 + (ratio * bezier_distance) / 2},${p1.y * 1000} ${p2.x * 1000 - (bezier_distance * ratio / 2)},${p2.y * 1000} ${p2.x * 1000},${p2.y * 1000}`;
};

const applyPaddingToPosition = (value, padding) => {
  return value * (1 - padding * 2) + padding;
};

// `maxTotal` is the max total of the maximum size step in the funnel
// (step 0 usually). if this is omitted, the total size will default to 100%.
const calculateFunnelStepYPositions = (step, maxSize) => {
  const { data } = step;
  let total = data.reduce((a, b) => a + b.total, 0);
  const padding = (1 - total / (maxSize || total)) / 2;

  let acc = 0;
  const relativeY = data.map(o => {
    let y = (o.total / total);
    acc += y;
    return { top: applyPaddingToPosition(acc - y, padding), bottom: applyPaddingToPosition(acc, padding) };
  });

  return { total, padding, relativeY }
}

class Funnel {
  constructor (svg) {
    this.svg = svg;
    this.padding = [0.05, 0.05];
    this.colors = [
      "#5ebcac",
      "#1c90dc",
      "#0e61cf",
      "#3629c7",
      "#c95a74",
    ];
  }

  dimensions (w, h) {
    let x = -(w / h) * this.padding[0] * 1000;
    let y = -this.padding[1] * 1000;
    let width = (w / h) * 1000 * (1 + this.padding[0] * 2);
    let height = 1000 * (1 + this.padding[1] * 2);

    this.svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    this.ratio = w / h;
  }

  data (steps) {
    if (!Array.isArray(steps) || typeof steps[0] !== "object") return `Steps data should be an array of objects.`;

    this.steps = steps;

    // this assumes the first funnel event is the largest.
    // if we don't necessarily believe this to be the case, just map through
    // all steps, get totals, and run `Math.max.apply(null, [...])`.
    let total = steps[0].data.reduce((a, b) => a + b.total, 0);
    this.maxFunnelTotal = total;
    let yPositions = steps.map(step => calculateFunnelStepYPositions(step, total));

    this.positions = yPositions;
  }

  drawPaths () {
    const { positions } = this;

    // create the `<path d="..." />` strings for the **top** side of the curve.
    let paths = new Array(positions[0].relativeY.length).fill("");
    for (let x = 0; x < positions.length - 1; x++) {
      for (let y = 0; y < positions[x].relativeY.length; y++) {
        paths[y] += createBeizerSVGPath({
          x: x / (positions.length - 1) * this.ratio,
          y: positions[x].relativeY[y].top
        }, {
          x: (x + 1) / (positions.length - 1) * this.ratio,
          y: positions[x + 1].relativeY[y].top,
        }, this.ratio)
      }
    }

    // create the `<path d="..." />` strings for the **bottom** side of the curve.
    for (let x = positions.length - 1; x >= 1; x--) {
      for (let y = 0; y < positions[x].relativeY.length; y++) {
        paths[y] += createBeizerSVGPath({
          x: x / (positions.length - 1) * this.ratio,
          y: positions[x].relativeY[y].bottom
        }, {
          x: (x - 1) / (positions.length - 1) * this.ratio,
          y: positions[x - 1].relativeY[y].bottom,
        }, -this.ratio)
      }
    }

    // create the actual `<path>` elements, and give them the `d`.
    // also color them from `this.colors`.
    paths.map((path, i) => {
      let pathE = document.createElementNS('http://www.w3.org/2000/svg', "path");
      pathE.setAttributeNS(null, "d", path.replace(/^L/, "M"));
      pathE.style.fill = this.colors[i];
      this.svg.appendChild(pathE);
    });
  }

  drawLines () {
    const { positions, steps } = this;

    let g = document.createElementNS('http://www.w3.org/2000/svg', "g");
    for (let x = 0; x < positions.length; x++) {
      if (steps[x].lines === false) continue;
      let lineE = document.createElementNS('http://www.w3.org/2000/svg', "line");
      lineE.classList.add("step-marker");
      lineE.setAttribute("x1", (this.ratio * 1000) * (x / (positions.length - 1)));
      lineE.setAttribute("x2", (this.ratio * 1000) * (x / (positions.length - 1)));
      lineE.setAttribute("y1", Math.max(-150, positions[x].padding * 1000 - 150));
      lineE.setAttribute("y2", Math.min(1150, 1000 - (positions[x].padding * 1000) + 100));

      let textE = document.createElementNS('http://www.w3.org/2000/svg', "text");
      textE.classList.add("step-header-conversion");
      textE.textContent = (100 * positions[x].total / this.maxFunnelTotal).toFixed(0) + "%";

      textE.setAttribute("x", (this.ratio * 1000) * (x / (positions.length - 1)) + 30);
      textE.setAttribute("y", Math.max(-120, positions[x].padding * 1000 - 150) + 30);

      let subtextE = document.createElementNS('http://www.w3.org/2000/svg', "text");
      subtextE.classList.add("step-header-name");
      subtextE.textContent = this.steps[x].step;

      subtextE.setAttribute("x", (this.ratio * 1000) * (x / (positions.length - 1)) + 30);
      subtextE.setAttribute("y", Math.max(-120, positions[x].padding * 1000 - 150) + 90);

      g.appendChild(lineE);
      g.appendChild(textE);
      g.appendChild(subtextE);
    }
    this.svg.appendChild(g);
  }

  drawLabels () {
    const { positions, steps } = this;

    let g = document.createElementNS('http://www.w3.org/2000/svg', "g");
    this.svg.appendChild(g);
    for (let x = 0; x < positions.length; x++) {
      if (steps[x].labels === false) continue;
      for (let y = 0; y < positions[x].relativeY.length; y++) {
        let labelE = document.createElementNS('http://www.w3.org/2000/svg', "text");
        labelE.textContent = (100 * this.steps[x].data[y].total / this.maxFunnelTotal).toFixed(0) + "%";
        labelE.setAttribute("x", (x / (positions.length - 1) * this.ratio) * 1000 + 50);
        labelE.setAttribute("y", ((positions[x].relativeY[y].top + positions[x].relativeY[y].bottom) / 2) * 1000);
        g.appendChild(labelE);

        let b = labelE.getBBox();

        let rectE = document.createElementNS('http://www.w3.org/2000/svg', "rect");
        rectE.classList.add("label-bg");
        rectE.setAttribute("x", b.x - 20);
        rectE.setAttribute("y", b.y - 10);
        rectE.setAttribute("width", b.width + 40);
        rectE.setAttribute("height", b.height + 20);

        // you have to paint this just so that you can measure it...
        g.insertBefore(rectE, labelE);
      }
    }
  }

  draw () {
    this.drawPaths();
    this.drawLabels();
    this.drawLines();
  }
}

export default Funnel;
