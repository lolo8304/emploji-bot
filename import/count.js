load("./collections.js");

for (var i = 0, l = importMeta.length; i < l; i++){
    print("count of "+importMeta[i].collection+"="+db.getCollection(importMeta[i].collection).count()+ " objects");
}
