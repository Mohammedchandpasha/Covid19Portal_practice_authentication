const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//get all stastes
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state;`;
  const states = await db.all(getStatesQuery);
  let list = [];
  for (let s of states) {
    let ob = {
      stateId: s.state_id,
      stateName: s.state_name,
      population: s.population,
    };
    list.push(ob);
  }

  response.send(list);
});
//get one state
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    SELECT * FROM state
    WHERE state_id=${stateId};`;
  const states = await db.all(getStatesQuery);
  for (let ob of states) {
    s = ob;
  }
  let responseOb = {
    stateId: s.state_id,
    stateName: s.state_name,
    population: s.population,
  };
  response.send(responseOb);
});
//post district
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const postDistrictQuery = `
    INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});
//get district based on ID API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district 
    WHERE district_id=${districtId};`;
    let s = await db.get(getDistrictQuery);
    let responseOb = {
      districtId: s.district_id,
      districtName: s.district_name,
      stateId: s.state_id,
      cases: s.cases,
      cured: s.cured,
      active: s.active,
      deaths: s.deaths,
    };
    response.send(responseOb);
  }
);
//delete district API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district
     WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
//update district API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district
    SET 
     district_name='${districtName}',
     state_id=${stateId},
     cases=${cases},
     cured=${cured},
     active=${active},
     deaths=${deaths}
      
    WHERE 
       district_id=${districtId}`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
//get stats of patients by stateId API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const getStatsQuery = `SELECT 
  sum(district.cases) as totalCases,
  sum(district.cured) as totalCured,
  sum(district.active) as totalActive,
  sum(district.deaths) as totalDeaths
   FROM district 
   NATURAL JOIN state
    WHERE district.state_id=${stateId}
    group by district.state_id ;`;
    const sta = await db.get(getStatsQuery);

    response.send(sta);
  }
);
module.exports = app;
