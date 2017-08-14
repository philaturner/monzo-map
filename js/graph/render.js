var graphCanvas = function( p ) {
  var counter = 0;
  var height;
  var nodes = [];
  var drawComplete = false;
  var len;
  var msgText;
  var maxSpend = 0;
  var dailySpend;
  var spendDiv;
  var spendDate;
  var yay = ['#E64B5F','#9ABBA8', '#E1B982','#EB824B','#50B9CD']
  p.setup = function() {
    noLoop();
  };

  p.firstRun = function() {
    height = document.getElementById('graph-container').offsetHeight;
    p.createCanvas(windowWidth, height);
    len = user.dates.difference();
    dailySpend = select('#daily-spend');
  };

  p.draw = function() {
    p.background(61);
    p.frameRate(15);
    p.noFill();
    p.stroke(255);
    let spacing = windowWidth/len;
    // y = random(0,height);
    // history.push(y);


    p.beginShape();
    //for (var i = 0; i < len; i++){
    for (var key in user.dates.spend) {
      let nx = counter * spacing;
      let ny = 0;
      let amount = (user.dates.spend[key])/100;

      //TODO fix top value scaling
      ny = map(amount,1,user.dates.max_spend/100,10,height-5);
      ny = height - ny;
      nodes.push([nx,ny,floor(user.dates.spend[key]/100),key]);
      p.vertex(nx,ny);
      p.fill(255);
      p.ellipse(nx,ny,5,5);
      p.noFill();
      counter++;
    }
    p.endShape();

    //check mouse over node
    p.fill(255,255,255,0.7);
    for (var i = 0; i < nodes.length; i ++){
      if (mouseX < nodes[i][0] + spacing/2 && mouseX > nodes[i][0] - spacing/2){
        if (mouseY > 0-55 && mouseY < height-55){
          //p.noStroke();

          //rect at mouse
          //p.rect(mouseX,mouseY+55,100,30);
          //p.fill(255,255,255);
          //p.textSize(16);
        //  p.text(nodes[i][3] + ': ' + currency.getCurrencySymbol(user.currency) + nodes[i][2],mouseX+10,mouseY+55);
          //p.noFill();
        //  p.fill(255,255,255,0.3);
          //hover rectangle
          p.rect(nodes[i][0]-spacing/2,0,spacing,height-5);
          dailySpend.style('visibility', 'visible');
          spendDiv = document.getElementById("spendamount");
          spendDiv.innerHTML = currency.getCurrencySymbol(user.currency) + nodes[i][2];
          spendDate = document.getElementById("spend-date");
          spendDate.innerHTML = nodes[i][3];
        }
        else {
          dailySpend.style('visibility', 'hidden');
        }
      }
    }

    p.noFill();
    if (counter >= len-1){
      counter = 0;
      nodes = [];
      //p.clear();
      //p.noLoop();
    }

  };
};
var graphLine = new p5(graphCanvas, 'graph-container');
