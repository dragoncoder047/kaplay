kaplay({ fixedUpdateMode: "ludicrous" });
loadBean();
setGravity(1000);

// Small bean
add([
    sprite("bean"),
    scale(0.2),
    pos(100, 50),
    anchor("center"),
    area({ restitution: 1 }),
    body({ mass: 0.2 }),
]);

// Medium bean
add([
    sprite("bean"),
    scale(0.5),
    pos(100, 100),
    anchor("center"),
    area({ restitution: 1 }),
    body({ mass: 0.5 }),
]);

// Large bean
add([
    sprite("bean"),
    pos(100, 145),
    anchor("center"),
    area({ restitution: 1 }),
    body(),
]);

// Floor
add([
    rect(100, 10),
    pos(100, 400),
    anchor("center"),
    area({ restitution: 1 }),
    body({ isStatic: true }),
]);
