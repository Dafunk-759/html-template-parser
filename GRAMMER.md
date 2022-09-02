## AST
- base node
Node {
  start = Number
  end = Number
  type
}

- root node
Template {
  include Node
  type = Template
  children = [Node]
}

- tag node
TagNode {
  include Node
  type = tag
  children = [Node]
  attrs = [AttrNode]
}

- attr node
AttrNode {
  include Node
  type = Attr
  key = String
  value = String
}

- text node
TextNode {
  include Node
  type = Text
  text = String
}

- mustache node
MustacheNode {
  include Node
  type = mustache
  expr = String
}

- comment node
CommentNode {
  include Node
  type = comment
  comment = String
}

## GRAMMER
- tokens
openTag: "<"
openTagWithSlash: "</"
closeTag: ">"
closeTagWithSlash: "/>"
tagName: "tagName"
attrKey: "attrKey"
attrText: "attrText"
eq: "="
openMustache: "{{"
closeMustache: "}}"
mustacheValue: "mustacheValue"
openComment: "<!--"
closeComment: "-->"
comment: "comment"
text: "text"
EOF: "EOF"

node ::
  | tagNode
  | textNode
  | commentNode
  | mustacheNode

tagNode ::
  openTag tagName (attrKey (eq attrText)?)* (
    | closeTagWithSlash 
    | closeTag (node)* openTagWithSlash tagName closeTag
  )

textNode :: text

commentNode ::
  openComment comment closeComment

mustacheNode ::
  openMustache mustacheValue closeMustache