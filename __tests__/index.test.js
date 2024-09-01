const axios = require("axios");

const url = "http://localhost:5000/";

describe("Start test", () => {
  test("Test index API", async () => {
    const res = await axios.get(url);

    expect(res).toBeTruthy();
    expect(res.status).toBe(200);
    expect(res.data).toEqual("API de GoPlan funcionando");
  });
});
