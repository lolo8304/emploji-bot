load("./collections.js");

for (var i = 0, l = importMeta.length; i < l; i++){
    print("drop of "+importMeta[i].collection);
    db[importMeta[i].collection].drop();
}

load("./count.js");