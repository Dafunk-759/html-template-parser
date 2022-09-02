const fs = require("fs");
const assert = require("assert");
const tp = require("../index");

describe("genToken", () => {
  it("should work 1", () => {
    let html = `\
<div>
  foo {{a}}
  <div baz="qux">{{b}}bar</div>
</div>`;

    assert.doesNotThrow(() => {
      for (let t of tp.genToken(html)) {
        console.log(t);
      }
    });
  });

  it("should work 2", () => {
    let html = `\
<!-- a comment  -->

<div class="foo"></div>

<h1>hello {{name}}!</h1>`;
    assert.doesNotThrow(() => {
      for (let t of tp.genToken(html)) {
        console.log(t);
      }
    });
  });

  it("should work 3", () => {
    let html = `\
<p>{{a}} {{b}} : {{c}} :</p>`;
    assert.doesNotThrow(() => {
      for (let t of tp.genToken(html)) {
        console.log(t);
      }
    });
  });

  it("should work 4", () => {
    let html = `\
<p bar='foo'>{{a}} {{b}} : {{c}} :</p>`;
    assert.doesNotThrow(() => {
      for (let t of tp.genToken(html)) {
        console.log(t);
      }
    });
  });

  it("should not work 4", () => {
    let html = `\
<p bar='foo">{{a}} {{b}} : {{c}} :</p>`;
    assert.throws(() => {
      try {
        for (let t of tp.genToken(html)) {
          console.log(t);
        }
      } catch (err) {
        console.error(err);
        throw err;
      }
    });
  });

  it("should not work 5", () => {
    let html = `\
<p bar='foo'>{{abcdefg</p>`;
    assert.throws(() => {
      try {
        for (let t of tp.genToken(html)) {
          console.log(t);
        }
      } catch (err) {
        console.error(err);
        throw err;
      }
    });
  });
});

describe("Parser", () => {
  it("should work 1", () => {
    let html = `\
<div>
  foo {{a}}
  <div baz="qux">{{b}}bar</div>
</div>`;

    assert.doesNotThrow(() => {
      let ret = new tp.Parser(html).parse();
      console.log(ret.children[0].children.forEach((c) => console.log(c)));
    });
  });

  it("should work 2", () => {
    let html = `\
<!-- a comment  -->

<div class="foo"></div>

<h1>hello {{name}}!</h1>`;
    assert.doesNotThrow(() => {
      let ret = new tp.Parser(html).parse();
      console.log(ret.children.length);
      console.log(ret.children.forEach((c) => console.log(c)));
    });
  });

  it("should work 3", () => {
    let html = `\
<p>{{a}} {{b}} : {{c}} :</p>`;
    assert.doesNotThrow(() => {
      let ret = new tp.Parser(html).parse();
      // console.log(ret);
    });
  });

  it("should work 4", () => {
    let html = `\
<p bar='foo'>{{a}} {{b}} : {{c}} :</p>`;
    assert.doesNotThrow(() => {
      let ret = new tp.Parser(html).parse();
      console.log(ret.children);
      console.log(ret.children[0].children);
      console.log(ret.children[0].attrs);
    });

    // Template {
    //   start: 0,
    //   end: 38,
    //   type: 'Template',
    //   children: [
    //     TagNode {
    //       start: 0,
    //       end: 38,
    //       type: 'Tag',
    //       children: [Array],
    //       name: 'p',
    //       attrs: [Array]
    //     }
    //   ]
    // }
  });

  it("should work with test.html", () => {
    assert.doesNotThrow(() => {
      let ret = new tp.Parser(
        fs.readFileSync(__dirname + "/test.html").toString("utf-8")
      ).parse();
      // console.log(ret);
    });
  });
});
