class Gym {
  constructor() {
    this.popsize = 50
    this.i = 0;
    this.maxI = 1000;
    this.e = 0;
    this.maxE = 10;

    this.learningRate = 0.01

    this.environment = new Intersection()
    this.startPosition = createVector(this.environment.bs * 2.5, this.environment.bs * 0.5)

    this.initAgents()
    this.target = createVector(width / 2, height - 10)
  }

  draw() {
    this.agents.forEach((agent, index) => drawAgent(agent, index))
    drawEnvironment(this.environment)
    fill(255, 0, 0)
    ellipse(this.target.x, this.target.y, 5, 5)
  }

  reset() {
    this.environment.reset()
    this.i = 0;
    this.agents.forEach(a => {
      a.pos = this.startPosition.copy()
      a.reset()
    })
  }

  initAgents() {
    this.agents = []
    for (let i = 0; i < this.popsize; i++) {
      this.agents.push(new Agent(this.startPosition.copy()))
    }
  }

  run() {
    text(this.i, width / 2, height / 2)
    this.updateAgents()
    this.environment.update(this.i)
    this.i++
  }

  updateAgents() {
    if (this.i === 150) { // remove agents that haven't reached a checkpoint yet
      this.agents = this.agents.filter(a => a.reachedCheckpoints > 0)
    }
    this.agents.filter(a => a.alive).forEach(agent => this.updateAgent(agent))
  }

  handleCollisions(agent, body) {
    // check collision with walls
    body.forEach(part => {
      if ([...this.environment.buildings, ...this.environment.getCars()].filter(b => b.colliding(part).length > 0).length > 0) {
        agent.kill()
      }
    })

    // kill if agent leaves environment. important for ai safety
    if (agent.pos.x > width || agent.pos.x < 0 || agent.pos.y < 0 || agent.pos.y > height) {
      agent.kill()
    }
  }

  handleCheckpoints(agent, body) {
    const nextCheckpoint = this.environment.checkpoints[agent.reachedCheckpoints % this.environment.checkpoints.length]
    if (body.some(part => nextCheckpoint.colliding(part).length > 0)) {
      agent.reachedCheckpoints++;
    }
  }

  getBody(agent) {
    return [new Line(agent.pos.x - 5, agent.pos.y, agent.pos.x + 5, agent.pos.y), new Line(agent.pos.x, agent.pos.y - 5, agent.pos.x, agent.pos.y + 5)]
  }

  updateAgent(agent) {
    const body = this.getBody(agent)
    this.handleCollisions(agent, body)
    this.handleCheckpoints(agent, body)

    const inputs = this.getInputs(agent)
    agent.update(inputs)
  }

  getInputs(agent) {
    const carsToCheck = this.environment.getCars().filter(c => c.lines[0].p1.dist(agent.pos) < agent.sensorLength * 1.5)
    const carSensorData = this.getSensorCollisionsWith(agent, carsToCheck)
    let inputs = [...carSensorData]
    const buildingSensorData = this.getSensorCollisionsWith(agent, this.environment.buildings)
    return [...inputs, ...buildingSensorData]
  }

  getSensorCollisionsWith(agent, otherObjects) {
    const inputs = []
    agent.sensors.forEach(s => {
      let closest = Infinity
      let closestPos = false
      otherObjects.forEach(b => {
        const sensorLine = this.transformSensor(s, agent)
        const cols = b.colliding(sensorLine)
        fill(0)
        cols.filter(col => col.dist(agent.pos) < agent.sensorLength).forEach(c => {
          if (agent.pos.dist(c) < closest) {
            closestPos = c
            closest = agent.pos.dist(c)
          }
        })
      })
      if (closestPos) {
        //line(agent.pos.x, agent.pos.y, closestPos.x, closestPos.y)
        inputs.push(map(closestPos.dist(agent.pos), 0, agent.sensorLength, 0, 1))
      } else {
        inputs.push(1)
      }
    })
    return inputs
  }

  transformSensor(s, agent) {
    const current = s.pos.copy()
    current.rotate(s.rot + agent.vel.heading())
    current.add(agent.pos)
    return new Line(current.x, current.y, agent.pos.x, agent.pos.y)
  }

  updateCheckpointDist(a) {
    const { checkpoints } = this.environment
    const nextCheckpoint = checkpoints[a.reachedCheckpoints]

    const startToCheckpoint = this.startPosition.dist(nextCheckpoint.pos)
    const agentToCheckpoint = a.pos.dist(nextCheckpoint.pos)
    const traveledDist = startToCheckpoint - agentToCheckpoint
    a.traveled += traveledDist
  }

  evaluate() {
    let bestNeuralNet = false
    let maxCheckpoints = 0
    this.agents.forEach(a => {
      if (!bestNeuralNet || (a.reachedCheckpoints > maxCheckpoints)) {
        maxCheckpoints = a.reachedCheckpoints
        bestNeuralNet = a.nn
      }
    })

    console.log(`Best one reached ${maxCheckpoints} checkpoints!`)

    // repopulate
    this.agents = []
    this.agents.push(new Agent(this.startPosition, bestNeuralNet))
    while (this.agents.length < this.popsize) {
      if (this.agents.length < this.popsize * 0.9) { // fill 90% of population with mutations of best from last generation
        const best = bestNeuralNet.copy()
        best.mutate(0.1)
        const a = new Agent(this.startPosition, best)
        this.agents.push(a)
      } else {
        this.agents.push(new Agent(this.startPosition))
      }
    }
  }

  running() {
    return this.i < this.maxI && this.agents.filter(a => a.alive).length > 0
  }
}