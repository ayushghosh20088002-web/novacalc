(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const expressionEl = $("expression"), resultEl = $("result"), hintEl = $("displayHint");
  let expression = "";
  let justEvaluated = false;
  let angleMode = "DEG";
  let history = [];
  let toastTimer;

  const showToast = (message) => {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
  };
  const formatNumber = (n) => {
    if (!Number.isFinite(n)) throw new Error("Result is not a finite number.");
    if (Object.is(n, -0)) n = 0;
    if (Math.abs(n) > 1e12 || (Math.abs(n) > 0 && Math.abs(n) < 1e-8)) return n.toExponential(8).replace(/\.?0+e/, "e");
    return Number(n.toPrecision(12)).toLocaleString("en-US", {useGrouping:false, maximumSignificantDigits:12});
  };
  const render = () => {
    expressionEl.textContent = expression || "0";
    hintEl.textContent = justEvaluated ? "Calculation complete" : (expression ? "Enter = or press Enter to calculate" : "Ready for your next calculation");
    if (!expression) resultEl.textContent = "0";
  };
  const insert = (value) => {
    if (justEvaluated && /^[0-9.(πe]/.test(value)) expression = "";
    justEvaluated = false;
    if (value === "^2" && expression) expression += "^2";
    else expression += value;
    render();
  };
  const clear = () => { expression = ""; justEvaluated = false; render(); };
  const deleteLast = () => { expression = expression.slice(0, -1); justEvaluated = false; render(); };

  // A small tokenizer + recursive-descent parser: no eval(), Function(), or executable input.
  function tokenize(source) {
    if (source.length > 512) throw new Error("Expression is too long (maximum 512 characters).");
    const s = source.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
    const tokens = []; let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      const rest = s.slice(i);
      const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (num) { tokens.push({type:"number", value:Number(num[0])}); i += num[0].length; if (tokens.length > 256) throw new Error("Expression has too many parts."); continue; }
      const id = rest.match(/^[a-zA-Z]+/);
      if (id) { tokens.push({type:"id", value:id[0].toLowerCase()}); i += id[0].length; if (tokens.length > 256) throw new Error("Expression has too many parts."); continue; }
      if ("+-*/^()%!".includes(s[i])) { tokens.push({type:s[i], value:s[i]}); i++; if (tokens.length > 256) throw new Error("Expression has too many parts."); continue; }
      if (s[i] === "π") { tokens.push({type:"id", value:"pi"}); i++; if (tokens.length > 256) throw new Error("Expression has too many parts."); continue; }
      throw new Error("Unsupported character: " + s[i]);
    }
    tokens.push({type:"eof", value:""}); return tokens;
  }
  function evaluate(source) {
    const tokens = tokenize(source); let pos = 0;
    const peek = () => tokens[pos];
    const take = (type) => { if (peek().type !== type) throw new Error("Unexpected input near " + (peek().value || "end")); return tokens[pos++]; };
    const angle = (x) => angleMode === "DEG" ? x * Math.PI / 180 : x;
    const trigInput = (x) => angleMode === "DEG" ? x * 180 / Math.PI : x;
    const factorial = (n) => {
      if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error("Factorial needs an integer from 0 to 170.");
      let out = 1; for (let k=2;k<=n;k++) out *= k; return out;
    };
    function primary() {
      if (peek().type === "number") return take("number").value;
      if (peek().type === "(") { take("("); const v = addSub(); take(")"); return v; }
      if (peek().type === "id") {
        const name = take("id").value;
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;
        if (!["sqrt","sin","cos","tan","asin","acos","atan","log","ln","abs","floor","ceil","round","exp"].includes(name)) throw new Error("Unknown function or constant: " + name);
        take("("); const x = addSub(); take(")");
        let value;
        switch(name) {
          case "sqrt": if (x < 0) throw new Error("Square root needs a non-negative number."); value=Math.sqrt(x); break;
          case "sin": value=Math.sin(angle(x)); break;
          case "cos": value=Math.cos(angle(x)); break;
          case "tan": if (Math.abs(Math.cos(angle(x))) < 1e-12) throw new Error("Tangent is undefined at this angle."); value=Math.tan(angle(x)); break;
          case "asin": if (x < -1 || x > 1) throw new Error("asin input must be between -1 and 1."); value=trigInput(Math.asin(x)); break;
          case "acos": if (x < -1 || x > 1) throw new Error("acos input must be between -1 and 1."); value=trigInput(Math.acos(x)); break;
          case "atan": value=trigInput(Math.atan(x)); break;
          case "log": if (x <= 0) throw new Error("Logarithm needs a positive number."); value=Math.log10(x); break;
          case "ln": if (x <= 0) throw new Error("Natural logarithm needs a positive number."); value=Math.log(x); break;
          case "abs": value=Math.abs(x); break;
          case "floor": value=Math.floor(x); break;
          case "ceil": value=Math.ceil(x); break;
          case "round": value=Math.round(x); break;
          case "exp": value=Math.exp(x); break;
        }
        return value;
      }
      if (peek().type === "+") { take("+"); return unary(); }
      if (peek().type === "-") { take("-"); return -unary(); }
      throw new Error("Expected a number or function.");
    }
    function postfix() { let v=primary(); while (peek().type === "!") { take("!"); v=factorial(v); } return v; }
    function power() { let a=postfix(); if (peek().type === "^") { take("^"); const b=unary(); a=Math.pow(a,b); } return a; }
    function unary() { if (peek().type === "+") { take("+"); return unary(); } if (peek().type === "-") { take("-"); return -unary(); } return power(); }
    function mulDiv() {
      let v=unary();
      while (peek().type === "*" || peek().type === "/") {
        const op=tokens[pos++].type, rhs=unary();
        if (op === "/" && rhs === 0) throw new Error("Cannot divide by zero.");
        v=op === "*" ? v*rhs : v/rhs;
      }
      return v;
    }
    function addSub() {
      let v=mulDiv();
      while (peek().type === "+" || peek().type === "-") {
        const op=tokens[pos++].type, rhs=mulDiv(); v=op === "+" ? v+rhs : v-rhs;
      }
      return v;
    }
    if (!source.trim()) throw new Error("Enter a calculation first.");
    const value=addSub();
    if (peek().type !== "eof") throw new Error("Please check the expression.");
    if (!Number.isFinite(value)) throw new Error("This calculation has no finite result.");
    return value;
  }
  function calculate() {
    try {
      const value=evaluate(expression);
      const formatted=formatNumber(value);
      resultEl.textContent=formatted; justEvaluated=true;
      hintEl.textContent="Calculation complete";
      history.unshift({expression, result:formatted, timestamp:new Date()});
      history=history.slice(0,50); renderHistory();
      showToast("Answer: " + formatted);
    } catch(err) { showToast(err.message || "Could not calculate that expression."); }
  }
  function renderHistory() {
    $("historyCount").textContent=history.length;
    $("miniHistoryCount").textContent=history.length + (history.length===1?" calculation":" calculations");
    const list=$("historyList");
    if (!history.length) { list.innerHTML='<div class="empty-state"><span>◷</span><b>No calculations yet</b><p>Your completed calculations will appear here.</p></div>'; return; }
    list.replaceChildren();
    history.forEach((item,index) => {
      const row=document.createElement("div"); row.className="history-item";
      const symbol=document.createElement("span"); symbol.className="history-symbol"; symbol.textContent="=";
      const details=document.createElement("div"); details.className="history-details";
      const exp=document.createElement("div"); exp.className="history-expression"; exp.textContent=item.expression;
      const res=document.createElement("div"); res.className="history-result"; res.textContent=item.result;
      details.append(exp,res);
      const use=document.createElement("button"); use.className="history-use"; use.textContent="Use again"; use.addEventListener("click",()=>{expression=item.expression;justEvaluated=false;render();switchPanel("calculator");});
      row.append(symbol,details,use); list.append(row);
    });
  }
  function switchPanel(name) {
    document.querySelectorAll(".tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.panel===name));
    document.querySelectorAll(".panel").forEach(panel=>panel.classList.toggle("active",panel.id===name+"Panel"));
  }
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>switchPanel(btn.dataset.panel)));
  $("keypad").addEventListener("click",(event)=>{
    const button=event.target.closest("button"); if(!button)return;
    if(button.dataset.action==="clear")clear();
    else if(button.dataset.action==="delete")deleteLast();
    else if(button.dataset.action==="equals")calculate();
    else if(button.dataset.insert!==undefined)insert(button.dataset.insert);
  });
  document.querySelectorAll("[data-constant]").forEach(btn=>btn.addEventListener("click",()=>insert(btn.dataset.constant)));
  $("degMode").addEventListener("click",()=>{angleMode="DEG";$("degMode").classList.add("active");$("radMode").classList.remove("active");showToast("Angle mode: degrees");});
  $("radMode").addEventListener("click",()=>{angleMode="RAD";$("radMode").classList.add("active");$("degMode").classList.remove("active");showToast("Angle mode: radians");});
  document.addEventListener("keydown",(event)=>{
    if (event.altKey||event.ctrlKey||event.metaKey) return;
    if (event.target.matches("input,select,textarea")) return;
    const k=event.key;
    if (/^[0-9.]$/.test(k)) insert(k);
    else if (["+","-","*","/","(",")","^","!"].includes(k)) insert(k);
    else if(k==="Enter"||k==="="){event.preventDefault();calculate();}
    else if(k==="Backspace"){event.preventDefault();deleteLast();}
    else if(k==="Escape")clear();
    else if(k.toLowerCase()==="p")insert("π");
  });
  $("themeToggle").addEventListener("click",()=>{
    const next=document.body.dataset.theme==="dark"?"light":"dark";
    document.body.dataset.theme=next; $("themeIcon").textContent=next==="dark"?"☼":"☾";
    $("themeToggle").setAttribute("aria-label",next==="dark"?"Switch to light theme":"Switch to dark theme");
    document.querySelector('meta[name="theme-color"]').content=next==="dark"?"#0b1020":"#f1f4fb";
  });
  $("clearHistory").addEventListener("click",()=>{history=[];renderHistory();showToast("History cleared.");});

  const units={
    length:{meter:1,kilometer:1000,centimeter:.01,millimeter:.001,mile:1609.344,yard:.9144,foot:.3048,inch:.0254},
    weight:{kilogram:1,gram:.001,milligram:.000001,pound:.45359237,ounce:.028349523125,tonne:1000},
    temperature:{celsius:"C",fahrenheit:"F",kelvin:"K"}
  };
  const labels={meter:"Meters",kilometer:"Kilometers",centimeter:"Centimeters",millimeter:"Millimeters",mile:"Miles",yard:"Yards",foot:"Feet",inch:"Inches",kilogram:"Kilograms",gram:"Grams",milligram:"Milligrams",pound:"Pounds",ounce:"Ounces",tonne:"Metric tonnes",celsius:"Celsius (°C)",fahrenheit:"Fahrenheit (°F)",kelvin:"Kelvin (K)"};
  function populateUnits() {
    const category=$("unitCategory").value, from=$("unitFrom"), to=$("unitTo"), names=Object.keys(units[category]);
    from.replaceChildren();to.replaceChildren();
    names.forEach((unit,i)=>{const a=new Option(labels[unit],unit),b=new Option(labels[unit],unit);from.add(a);to.add(b);});
    from.value=names[0];to.value=names[Math.min(1,names.length-1)];updateConversion();
  }
  function tempToC(v,u){if(u==="celsius")return v;if(u==="fahrenheit")return (v-32)*5/9;return v-273.15;}
  function cToTemp(v,u){if(u==="celsius")return v;if(u==="fahrenheit")return v*9/5+32;return v+273.15;}
  function updateConversion() {
    const category=$("unitCategory").value, from=$("unitFrom").value, to=$("unitTo").value, raw=$("unitValue").value;
    if(raw.trim()===""||!Number.isFinite(Number(raw))){$("conversionOutput").textContent="Enter a valid number";$("conversionDetail").textContent="Use a finite numeric value.";return;}
    const input=Number(raw);let output;
    if(category==="temperature") {if(from==="kelvin"&&input<0){$("conversionOutput").textContent="Invalid temperature";$("conversionDetail").textContent="Kelvin cannot be below absolute zero.";return;}const c=tempToC(input,from);output=cToTemp(c,to);if(to==="kelvin"&&output<0){$("conversionOutput").textContent="Invalid temperature";$("conversionDetail").textContent="Kelvin cannot be below absolute zero.";return;}}
    else output=input*units[category][from]/units[category][to];
    $("conversionOutput").textContent=formatNumber(output)+" "+labels[to];
    $("conversionDetail").textContent=formatNumber(input)+" "+labels[from]+" = "+formatNumber(output)+" "+labels[to];
  }
  $("unitCategory").addEventListener("change",populateUnits);
  ["unitFrom","unitTo","unitValue"].forEach(id=>$(id).addEventListener("input",updateConversion));
  $("convertButton").addEventListener("click",()=>{updateConversion();showToast("Conversion updated.");});

  const numberOf=(id)=>Number($(id).value);
  function percentageUpdate() {
    const rate=numberOf("pctRate"), num=numberOf("pctNumber");
    $("pctResult").textContent=Number.isFinite(rate)&&Number.isFinite(num)?`${formatNumber(rate)}% of ${formatNumber(num)} = ${formatNumber(rate*num/100)}`:"Enter valid numbers";
    const price=numberOf("discountPrice"), discount=numberOf("discountRate");
    if(price>=0&&discount>=0&&discount<=100&&Number.isFinite(price)&&Number.isFinite(discount)){$("discountResult").textContent=`Pay ${formatNumber(price*(1-discount/100))} · Save ${formatNumber(price*discount/100)}`;}else $("discountResult").textContent="Use a price ≥ 0 and discount from 0–100%.";
    const old=numberOf("oldValue"), next=numberOf("newValue");
    if(old!==0&&Number.isFinite(old)&&Number.isFinite(next)){const change=(next-old)/Math.abs(old)*100;$("changeResult").textContent=`${formatNumber(Math.abs(change))}% ${change>0?"increase":change<0?"decrease":"change (no difference)"}`;}else if(old===0&&next===0)$("changeResult").textContent="No change (both values are zero)";else $("changeResult").textContent="Old value must not be zero.";
    const a=numberOf("ratioA"),b=numberOf("ratioB");
    if(Number.isFinite(a)&&Number.isFinite(b)&&(a!==0||b!==0)){const gcd=(x,y)=>{x=Math.abs(x);y=Math.abs(y);while(y){const remainder=x%y;x=y;y=remainder;}return x;};const scale=1000000, ai=Math.round(a*scale),bi=Math.round(b*scale),g=gcd(ai,bi)||1;$("ratioResult").textContent=`${formatNumber(ai/g)} : ${formatNumber(bi/g)}`;}else if(a===0&&b===0)$("ratioResult").textContent="0 : 0 (undefined ratio)";else $("ratioResult").textContent="Enter valid numbers";
  }
  ["pctRate","pctNumber","discountPrice","discountRate","oldValue","newValue","ratioA","ratioB"].forEach(id=>$(id).addEventListener("input",percentageUpdate));
  $("year").textContent=new Date().getFullYear();
  populateUnits();percentageUpdate();render();renderHistory();
})();