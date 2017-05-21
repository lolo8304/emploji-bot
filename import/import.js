load("./collections.js");

for (var i = 0, l = importMeta.length; i < l; i++){
    var toDrop = importMeta[i].toDrop;
    if (toDrop == undefined) {
        noDrop = true;
    }
    if (toDrop) {
        print(" start collection "+importMeta[i].collection + " dropping and importing ...");
        db.getCollection(importMeta[i].collection).drop();
        db.getCollection(importMeta[i].collection).dropIndex( { "$**": "-1" });
    } else {
        print(" start collection "+importMeta[i].collection + " importing ...");
    }

    var fileContent = cat(importMeta[i].file);
    db.getCollection(importMeta[i].collection).insertMany(JSON.parse(fileContent));
    if (toDrop) {
        db.getCollection(importMeta[i].collection).createIndex( { "$**": "text" });
    }
    
    print(" done. imported "+db.getCollection(importMeta[i].collection).count()+ " objects");
}
