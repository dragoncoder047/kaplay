kaplay();

const tests = {};

const t = add([
    pos(100, 100),
    text(),
]);

const s = add([
    pos(100, 200),
    text(),
]);

function test(name, f) {
    onUpdate(() => {
        const x = (tests[name] ??= { n: 0, p: 0 });
        x.n++;
        if (f()) x.p++;
    });
}

onUpdate(() => {
    t.text = Object.entries(tests).map(([name, { n, p }]) =>
        `${name}: ${p}/${n} ${(p / n * 100).toFixed(1)}%`
    ).join("\n");
});

function similar(a, b) {
    return Math.abs(a - b) < 1e-13;
}

test("random inout", () => {
    const m1 = new Mat23();
    const m2 = new Mat23();
    const translation = rand(vec2(-100), vec2(100));
    const rotation = rand(-180, 180);
    const scale = rand(vec2(-3), vec2(3));
    const skew = randi() ? vec2(rand(-3, 3), 0) : vec2(0, rand(-3, 3));
    m1.setTRSS(
        translation.x,
        translation.y,
        rotation,
        scale.x,
        scale.y,
        skew.x,
        skew.y,
    );
    const translation2 = m1.getTranslation();
    const rotation2 = m1.getRotation();
    const scale2 = m1.getScale();
    const skew2 = m1.getSkew();
    m2.setTRSS(
        translation2.x,
        translation2.y,
        rotation2,
        scale2.x,
        scale2.y,
        skew2.x,
        skew2.y,
    );
    debug.clearLog();
    debug.log("\n\n");
    debug.log(
        "translation",
        translation,
        translation2,
        "error",
        translation2.sub(translation),
    );
    debug.log("rotation", rotation, rotation2, "error", rotation2 - rotation);
    debug.log("scale", scale, scale2, "error", scale2.sub(scale));
    debug.log("skew", skew, skew2, "error", skew2.sub(skew));
    return (
        similar(m1.a, m2.a)
        && similar(m1.b, m2.b)
        && similar(m1.c, m2.c)
        && similar(m1.d, m2.d)
        && similar(m1.e, m2.e)
        && similar(m1.f, m2.f)
    );
});

let singularities = 0;
test("fully random matrix", () => {
    const m1 = new Mat23();
    const m2 = new Mat23();
    m1.a = rand(-100, 100);
    m1.b = rand(-100, 100);
    m1.c = rand(-100, 100);
    m1.d = rand(-100, 100);
    m1.e = rand(-100, 100);
    m1.f = rand(-100, 100);
    if (similar(m1.det, 0)) {
        singularities++;
        s.text = singularities + " singularities";
        return true;
    }
    const translation = m1.getTranslation();
    const rotation = m1.getRotation();
    const scale = m1.getScale();
    const skew = m1.getSkew();
    m2.setTRSS(
        translation.x,
        translation.y,
        rotation,
        scale.x,
        scale.y,
        skew.x,
        skew.y,
    );
    return (
        similar(m1.a, m2.a)
        && similar(m1.b, m2.b)
        && similar(m1.c, m2.c)
        && similar(m1.d, m2.d)
        && similar(m1.e, m2.e)
        && similar(m1.f, m2.f)
    );
});
