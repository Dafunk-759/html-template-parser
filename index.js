class Token {
  constructor(type, value, start, end) {
    this.type = type;
    this.value = value;
    this.start = start;
    this.end = end;
  }

  static t = {
    openTag: "<",
    openTagWithSlash: "</",
    closeTag: ">",
    closeTagWithSlash: "/>",
    tagName: "tagName",
    attrKey: "attrKey",
    attrText: "attrText",
    eq: "=",
    openMustache: "{{",
    closeMustache: "}}",
    mustacheValue: "mustacheValue",
    openComment: "<!--",
    closeComment: "-->",
    comment: "comment",
    text: "text",
    EOF: "EOF",
  };
}

function* genToken(src) {
  let pos = 0;

  const commentOrTagOrMustache = /(<!--)|(<\/|<)|({{)/y;
  const closeComment = /(-->)/y;
  const closeMustache = /(}})/y;
  const tagName = /([a-zA-Z][a-zA-Z0-9:\-]*)/y;
  const whiteSpace = /(\s)+/y;
  const closeOrKeyOrValueOrEq = /(\/>|>)|([^>/=\s'"]+)|(['"])|(=)/y;

  const exec = (re) => {
    re.lastIndex = pos;
    return re.exec(src);
  };

  const test = (re) => {
    re.lastIndex = pos;
    return re.test(src);
  };

  const error = (msg) => {
    throw new Error(`Token err: ${msg} at ${pos}`);
  };

  const makeTokenAndAdvance = (type, val, re) => {
    let t = new Token(type, val, pos, re.lastIndex);
    pos = re.lastIndex;
    return t;
  };

  const readUntilAndMakeToken = (re, type, checkBound = false) => {
    let val = "";
    const start = pos;
    while (pos < src.length && !test(re)) {
      val += src[pos];
      pos++;
    }

    if (checkBound) {
      if (pos >= src.length) error(`Fail to read token:${type} readed:${val}`);
    }
    
    return new Token(type, val, start, pos);
  };

  function* genAttrs() {
    while (true) {
      // skip whiteSpace before attrs
      if (exec(whiteSpace)) {
        pos = whiteSpace.lastIndex;
      }

      // 1 close 2 key 3 value 4 eq
      let ret = exec(closeOrKeyOrValueOrEq);

      if (ret == null) {
        error("Invalid attr");
        break;
      }

      let val;
      // 1 close
      if ((val = ret[1])) {
        yield makeTokenAndAdvance(val, val, closeOrKeyOrValueOrEq);
        break;
      }

      // 2 key
      if ((val = ret[2])) {
        yield makeTokenAndAdvance(Token.t.attrKey, val, closeOrKeyOrValueOrEq);
        continue;
      }

      // 3 value
      // now val is ' or "
      if ((val = ret[3])) {
        pos = closeOrKeyOrValueOrEq.lastIndex;
        // read until next val
        let string = val;
        while (pos < src.length && src[pos] !== val) {
          string += src[pos];
          pos++;
        }
        if (pos >= src.length) error("Unclose attr value:" + string);
        // add last ' or "
        string += src[pos];
        pos++;
        yield new Token(
          Token.t.attrText,
          string,
          closeOrKeyOrValueOrEq.lastIndex,
          pos
        );
        continue;
      }

      // 4 eq
      if ((val = ret[4])) {
        yield makeTokenAndAdvance(Token.t.eq, val, closeOrKeyOrValueOrEq);
        continue;
      }
    }
  }

  while (true) {
    if (pos >= src.length) {
      yield new Token(Token.t.EOF, "EOF");
      break;
    }

    let ret = exec(commentOrTagOrMustache);

    // text
    if (ret == null) {
      yield readUntilAndMakeToken(commentOrTagOrMustache, Token.t.text);
      continue;
    }

    let val;
    // 1 comment
    if ((val = ret[1])) {
      yield makeTokenAndAdvance(
        Token.t.openComment,
        val,
        commentOrTagOrMustache
      );
      yield readUntilAndMakeToken(closeComment, Token.t.comment);

      let close = exec(closeComment);
      if (close == null) error("Expect end comment tag");
      yield makeTokenAndAdvance(Token.t.closeComment, close[1], closeComment);
      continue;
    }

    // 2 open tag
    if ((val = ret[2])) {
      yield makeTokenAndAdvance(val, val, commentOrTagOrMustache);

      let tag = exec(tagName);
      if (tag == null) error("Invalid tagName");
      yield makeTokenAndAdvance(Token.t.tagName, tag[1], tagName);

      yield* genAttrs();
      continue;
    }

    // 3 open mustache
    if ((val = ret[3])) {
      yield makeTokenAndAdvance(
        Token.t.openMustache,
        val,
        commentOrTagOrMustache
      );

      yield readUntilAndMakeToken(closeMustache, Token.t.mustacheValue);

      let close = exec(closeMustache);
      if (close == null) error("Expect end closeMustache tag");
      yield makeTokenAndAdvance(Token.t.closeMustache, close[1], closeMustache);
      continue;
    }
  }
}

class Node {
  constructor(start, end, type) {
    this.start = start;
    this.end = end;
    this.type = type;
  }
}

class Template extends Node {
  constructor(start, end, children) {
    super(start, end, "Template");
    this.children = children;
  }
}

class TagNode extends Node {
  constructor(start, end, name, children, attrs) {
    super(start, end, "Tag");
    this.children = children;
    this.name = name;
    this.attrs = attrs;
  }
}

class AttrNode extends Node {
  constructor(start, end, key, value) {
    super(start, end, "Attr");
    this.key = key;
    this.value = value;
  }
}

class TextNode extends Node {
  constructor(start, end, text) {
    super(start, end, "Text");
    this.text = text;
  }
}

class MustacheNode extends Node {
  constructor(start, end, expr) {
    super(start, end, "Mustache");
    this.expr = expr;
  }
}

class CommentNode extends Node {
  constructor(start, end, comment) {
    super(start, end, "Comment");
    this.comment = comment;
  }
}

class Parser {
  constructor(src) {
    if (typeof src !== "string") {
      throw new TypeError("Expect a string");
    }

    this.genToken = genToken(src);
    this.currentToken = this.#nextToken();
  }

  #error(msg) {
    throw new Error(
      "Parser Error:" +
        msg +
        `start: ${this.currentToken.start} end: ${this.currentToken.end}`
    );
  }

  #nextToken() {
    let ret = this.genToken.next();
    if (ret.done) throw new Error("NextToken Error:No more token");
    return ret.value;
  }

  #eat(expected) {
    if (this.currentToken.type !== expected)
      this.#error(`\
Unexpected token. expected: '${expected}' \
actually: '${this.currentToken.type}' `);
    this.currentToken = this.#nextToken();
  }

  #mustacheNode() {
    const start = this.currentToken.start;
    this.#eat(Token.t.openMustache);
    const expr = this.currentToken.value;
    this.#eat(Token.t.mustacheValue);
    const end = this.currentToken.end;
    this.#eat(Token.t.closeMustache);
    return new MustacheNode(start, end, expr);
  }

  #commentNode() {
    const start = this.currentToken.start;
    this.#eat(Token.t.openComment);
    const comment = this.currentToken.value;
    this.#eat(Token.t.comment);
    const end = this.currentToken.end;
    this.#eat(Token.t.closeComment);
    return new CommentNode(start, end, comment);
  }

  #textNode() {
    const { start, end, value } = this.currentToken;
    this.#eat(Token.t.text);
    return new TextNode(start, end, value);
  }

  #tagNode() {
    const start = this.currentToken.start;
    this.#eat(Token.t.openTag);
    let tagName = this.currentToken.value;
    this.#eat(Token.t.tagName);

    let attrs = [];
    let children = [];

    // parse attrs
    while (this.currentToken.type === Token.t.attrKey) {
      const start = this.currentToken.start;
      let key = this.currentToken.value;
      this.#eat(Token.t.attrKey);
      if (this.currentToken.type === Token.t.eq) {
        this.#eat(Token.t.eq);
        let val = this.currentToken.value;
        const end = this.currentToken.end;
        this.#eat(Token.t.attrText);
        attrs.push(new AttrNode(start, end, key, val));
      } else {
        const end = this.currentToken.end;
        attrs.push(new AttrNode(start, end, key, true));
      }
    }

    if (this.currentToken.type === Token.t.closeTagWithSlash) {
      // self close(no children)
      const end = this.currentToken.end;
      this.#eat(Token.t.closeTagWithSlash);
      return new TagNode(start, end, tagName, children, attrs);
    } else {
      this.#eat(Token.t.closeTag);
      while (this.currentToken.type !== Token.t.openTagWithSlash) {
        children.push(this.#node());
      }
      this.#eat(Token.t.openTagWithSlash);
      let endTag = this.currentToken.value;
      if (endTag !== tagName)
        this.#error(`End tagname:${endTag} not match start tagname:${tagName}`);
      this.#eat(Token.t.tagName);
      const end = this.currentToken.end;
      this.#eat(Token.t.closeTag);
      return new TagNode(start, end, tagName, children, attrs);
    }
  }

  #node() {
    switch (this.currentToken.type) {
      case Token.t.openTag:
        return this.#tagNode();
      case Token.t.text:
        return this.#textNode();
      case Token.t.openComment:
        return this.#commentNode();
      case Token.t.openMustache:
        return this.#mustacheNode();
    }
  }

  parse() {
    let { start } = this.currentToken;
    let children = [];
    while (this.currentToken.type !== Token.t.EOF) {
      children.push(this.#node());
    }
    let end = children?.[children.length - 1]?.end;
    return new Template(start, end, children);
  }
}

module.exports = {
  genToken,
  Parser,
};
