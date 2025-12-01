kaplay();
loadBean();

const spinningBean = add([
    pos(100, 100),
    sprite("bean"),
    anchor("top"),
    rotate(),
    {
        update() {
            this.angle += 200 * dt();
        },
    },
]);

const scalingBean = add([
    pos(200, 100),
    sprite("bean"),
    anchor("top"),
    rotate(),
    scale(),
    constraint.rotation(spinningBean, { ratio: 2, strength: 0.5 }),
]);

loop(0.5, () => scalingBean.scaleBy(-1));
