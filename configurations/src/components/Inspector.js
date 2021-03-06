import React, { useRef, useEffect } from 'react';
import useStyles from './Inspector.styles';
import { vectorFromAngle } from '../lib/Math'
import { RACE_ENV, TRAFFIC_ENV } from '../consts'
import Description from './Description'

import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'

export default class Inspector extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      isLoaded: false,
      items: [],
      boundaries: false,
      n: 5,
    }

    this.settingsHandler = this.settingsHandler.bind(this)
    this.Controlls = this.Controlls.bind(this)
    this.Settings = this.Settings.bind(this)
  }

  componentDidMount() {
    fetch(`/api/all_entrys`)
      .then(res => res.json())
      .then(
        (data) => {
          const env = RACE_ENV;
          const entrys = transform(data)
          const boundaries = getBoundaries(entrys)
          const settings = entrys.get(`${RACE_ENV}-${this.state.n}-75-170`).settings
          const matrix = genMatrix(entrys, boundaries, settings.n, env)
          this.setState({
            env,
            entrys,
            boundaries,
            matrix,
            settings,
            isLoaded: true,
          });
        },
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
  }

  render() {
    if (!this.state.isLoaded) return "loading..."

    return (
      <Container>
        <Row>
          <Col>
            <h1> Configurations </h1>
          </Col>
        </Row>
        <Row>
          <Col>
            <Description></Description>
          </Col>
        </Row>
        <Row>
          <Col>
            <Grid matrix={this.state.matrix} settingsHandler={this.settingsHandler}></Grid>
          </Col>
        </Row>
        <Row className="justify-content-md-center">
          <Col>
            <Canvas style={{ marginTop: "2rem" }} settings={this.state.settings} />
          </Col>
          <Col>
            <this.Controlls />
            <this.Settings />
            <button onClick={() => { this.changeEnv() }}>Change Environment</button>
          </Col>
        </Row>
      </Container>
    )
  }

  changeEnv() {
    const newEnv = this.state.env === TRAFFIC_ENV ? RACE_ENV : TRAFFIC_ENV
    this.setState({
      env: newEnv,
      matrix: genMatrix(this.state.entrys, this.state.boundaries, this.state.n, newEnv)
    })
  }

  settingsHandler(cell) {
    this.setState({
      settings: cell.settings
    })
  }

  changeN(c) {
    const newN = (this.state.n + c > 1) && (this.state.n + c <= 10) ? this.state.n + c : this.state.n
    const settings = { ...this.state.settings }
    settings.n = newN
    this.setState({
      n: newN,
      settings,
      matrix: genMatrix(this.state.entrys, this.state.boundaries, newN, this.state.env)
    })
  }

  Controlls() {
    return (
      <div>
        Number of Sensors: {this.state.settings.n}
        <button onClick={() => { this.changeN(-1) }}>
          -
        </button>
        <button onClick={() => { this.changeN(1) }}>
          +
        </button>
      </div>
    )
  }

  Settings() {
    return (
      <span>
        <div>
          Length of Sensors: {this.state.settings.l}
        </div>
        <div>
          Field of View: {this.state.settings.f}
        </div>
        <div>
          Environment: {this.state.env}
        </div>
      </span>
    )
  }
}

const Canvas = props => {
  const canvasRef = useRef(null)
  const { settings } = props
  useEffect(() => {
    const canvas = canvasRef.current
    const w = 200;
    const h = 200;
    canvas.width = w
    canvas.height = h
    const center = { x: w / 2, y: h / 2 }
    const context = canvas.getContext('2d')
    const sensorVectors = []
    const { f, n, l } = settings

    for (let i = 0; i < n; i++) {
      const angle = Math.floor(mapValue(i, 0, n - 1, 90 - (f / 2), 90 + (f / 2)))
      const v = vectorFromAngle(angle)
      sensorVectors.push(v)
    }

    context.beginPath();
    const carW = 10;
    const carH = 25;
    context.fillStyle = "green"
    context.fillRect(center.x - carW / 2, center.y - carH / 2, carW, carH)

    sensorVectors.forEach(v => {
      context.moveTo(center.x, center.y);
      context.lineTo(center.x - v.x * l, center.y - v.y * l);
    })


    context.stroke();
  }, [settings])


  return <canvas ref={canvasRef} {...props} />
}

const Grid = ({ matrix, settingsHandler }) => {
  const classes = useStyles();

  return (
    <span>
      <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
        <span style={{ writingMode: "vertical-lr" }}>&larr; Sensor Length &rarr;</span>
        <div style={{ display: "inline-block", backgroundColor: "black" }}>
          <span className={classes.grid}>
            {matrix.map((row, i) => {
              return row.map((cell, y) => {
                return (
                  <div
                    key={`${i}${y}`}
                    style={{ background: cell.untrained ? '#404040' : cell.solved ? 'green' : 'black' }}
                    className={classes.cell}
                    onMouseEnter={() => { settingsHandler(cell) }}
                    onClick={() => { goToGym(cell) }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                )
              })
            })
            }
          </span>
        </div>
      </div>
      <div>&larr; Field of view &rarr;</div>
    </span>
  );
};

function mapValue(v, in_min, in_max, out_min, out_max) {
  return (v - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function goToGym(cell) {
  const url = urlFromCell(cell)
  window.location = url
}

function urlFromCell(cell) {
  return `/index.html?env=${cell.settings.e}&n=${cell.settings.n}&l=${cell.settings.l}&f=${cell.settings.f}`
}

function settingsFrom(key) {
  const split = key.split('-')
  return {
    e: split[0],
    n: parseInt(split[1]),
    l: parseInt(split[2]),
    f: parseInt(split[3]),
  }
}

function transform(data) {
  const entrys = new Map()
  data.forEach(d => {
    const key = d[0]
    const checkpoints = d[1]
    const solved = d[2]
    entrys.set(key, { settings: settingsFrom(key), checkpoints, solved })
  })
  return entrys
}

function getBoundaries(entrys) {
  const boundaries = {
    n: {
      vals: new Set(),
      min: Infinity,
      max: 0,
    },
    l: {
      vals: new Set(),
      min: Infinity,
      max: 0,
    },
    f: {
      vals: new Set(),
      min: Infinity,
      max: 0,
    },
  }

  const props = ['n', 'l', 'f']
  entrys.forEach(e => {
    const s = e.settings
    props.forEach(prop => {
      boundaries[prop].min = s[prop] < boundaries[prop].min ? s[prop] : boundaries[prop].min
      boundaries[prop].max = s[prop] > boundaries[prop].max ? s[prop] : boundaries[prop].max
      boundaries[prop].vals.add(s[prop])
    })

  })

  props.forEach(prop => {
    const array = Array.from(boundaries[prop].vals);
    array.sort(function (a, b) {
      return a - b;
    });
    boundaries[prop].vals = array
  })

  return boundaries
}

function genMatrix(entrys, boundaries, n, env) {
  const matrix = []
  boundaries.l.vals.forEach(l => {
    const row = []
    boundaries.f.vals.forEach(f => {
      const entry = entrys.get(`${env}-${n}-${l}-${f}`)
      if (!entry) {
        row.push(emptyCell(env, n, l, f))
      } else {
        row.push(entry)
      }
    })
    matrix.push(row)
  })
  return matrix
}

function emptyCell(e, n, l, f) {
  const checkpoints = 0
  const solved = false
  return { settings: { e, n, l, f }, checkpoints, solved, untrained: true }
}

export {
  settingsFrom,
  transform,
  getBoundaries,
  genMatrix,
  urlFromCell
}