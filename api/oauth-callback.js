// Implicit OAuth 2.0 Flow Callback
module.exports = async (req, res) => {
  res.write(`
<div>
Copy the values below into Vercel.
<br>The access_token will expire in 1 year.
<table border="1" style="width: 100%;">
  <thead>
    <tr><th>Vercel Environment Variable</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>FITBUT_USER_ID</td><td id="user_id"></td></tr>
    <tr><td>FITBIT_USER_TOKEN</td><td style="word-break: break-all;" id="user_token"></td></tr>
  </tbody>
</table>
</div>
<script>
const hash = window.location.hash.slice(1); //Remove leading '#'
const hashObj = hash
  .split('&')
  .map(s => s.split('='))
  .map(([k,v]) => ({
    [k]: v
  }))
  .reduce((acc, itm)=>({ ...acc, ...itm }), {});
console.log(hashObj);
document.getElementById("user_id").innerText = hashObj.user_id;
document.getElementById("user_token").innerText = hashObj.access_token;
</script>
`);
  res.end();
};