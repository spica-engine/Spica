{  
  function __cel$ltr__(lhs, rhs)  { 
    return rhs.reduce( (t,h) => ({...h, lhs: t}), lhs) 
  }  
}

Expr // "Common Expresxsion"
  = t:ConditionalOr  "?"  s:Expr  ":"   p:Expr
	{ return {kind: "operator", type: "conditional", category:"tenary", primary:p, rhs:p, tertiary:t} }    
  / ConditionalOr


ConditionalOr = lhs:ConditionalAnd rhs:(ConditionalOrOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
ConditionalOrOperation =  "||"  rhs:ConditionalAnd { 
  return {kind: "operator", type:"or", category:"binary", rhs} 
}


ConditionalAnd = lhs:Relation rhs:(ConditionalAndOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
ConditionalAndOperation = "&&" rhs:Relation { 
  return {kind: "operator", type:"and", category:"binary", rhs}
}


Relation = lhs:Addition rhs:(RelationOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
RelationOperation = type:("<=" / "<" / ">=" / ">" / "==" / "!=" / "in")  rhs:Addition { 
  return {kind: "operator", type, category:"binary", rhs} 
}


Addition = lhs:Multiplication rhs:(AdditionOperation)* { 
  return __cel$ltr__(lhs, rhs)
} 
AdditionOperation = type:("+" / "-") rhs:Multiplication { 
  return {kind: "operator", type, category:"binary", rhs} 
}


Multiplication = lhs:Unary rhs:(MultiplicationOperation)* { 
  return __cel$ltr__(lhs, rhs) 
} 
MultiplicationOperation = type:("*" / "/" / "%")  rhs:Unary { 
  return {kind: "operator", type, category:"binary", rhs} 
}

Unary      
  = Member
  / "!" "!"* member:Member { return {kind: "unary", type: "not", member} }
  / "-" "-"* member:Member { return {kind: "unary", type: "negative", member} }

Member
  = lhs:(LITERAL / Atomic) rhs:(MemberOperation)* { return __cel$ltr__(lhs, rhs) }

MemberOperation
  =  "."  rhs:Atomic { return { kind: "operator", type:"select", category:"binary", rhs } }
  /  "["  rhs:Expr  "]" { return { kind: "operator", type:"index", category:"binary", rhs } }
  /  "{"  rhs:FieldInits  "}" { return { kind: "operator", type:"construct", category:"binary", rhs } }
  /  "("  args:ExprList  ")" { return { kind: "call", arguments: args.expressions } }
 
 
Atomic
  = "["  exprList:ExprList  "]" { return exprList }
  / "{"  mapInits:MapInits  "}" { return mapInits }
  / "("  expr:Expr  ")" { return expr }
  / "."  primary:IDENT { return {kind: "operator", type: "fully_qualify", category:"unary", primary}}
  / IDENT


ExprList       = lhs:Expr rhs:("," expr:Expr {return expr})* {
	const expressions = [lhs];
	if (rhs) {
		expressions.push(...rhs);
	} 
	return {
		kind: "expressionlist",
		expressions
	}
}
FieldInits     = IDENT ":" Expr ("," IDENT ":" Expr)*
MapInits       = Expr ":" Expr ("," Expr ":" Expr)*


// LEXIS
IDENT = !RESERVED [_a-zA-Z][_a-zA-Z0-9]*  { 
	return {kind: "identifier", name: text()} 
}


LITERAL = value:FLOAT_LIT { return { kind: "literal", type: "double", value } }
        / value:UINT_LIT { return { kind: "literal", type: "uint", value } }
        / value:INT_LIT { return { kind: "literal", type: "int", value } }
        / value:BYTES_LIT { return { kind: "literal", type: "bytes", value } }
        / value:STRING_LIT { return { kind: "literal", type: "string", value } } 
        / value:BOOL_LIT { return { kind: "literal", type: "bool", value: value == "true" } } 
        / NULL_LIT { return { kind: "literal", type: "null", value: null } }

INT_LIT = "0x" HEXDIGIT+ { return parseInt(text(), 16) }
  / DIGIT+ { return parseInt(text(), 10) }
  
UINT_LIT = int:INT_LIT [uU] { return Math.abs(int) }

FLOAT_LIT = DIGIT* "." DIGIT+ EXPONENT? / DIGIT+ EXPONENT { 
	return parseFloat(text())
}

DIGIT = [0-9]

HEXDIGIT = [0-9abcdefABCDEF]

EXPONENT = [eE] [+-]? DIGIT+
  
STRING_LIT = raw:[rR]? chars:(
    '"""' chars:( !( '"""' ) (ESCAPE / .) )* '"""' { return chars.map( t => t[1] ) }
    / "'''" chars:( !( "'''" ) (ESCAPE / .) )* "'''" { return chars.map( t => t[1] ) }
    / '"' chars:( !( '"'  / NEWLINE ) (ESCAPE / .) )* '"'   { return chars.map( t => t[1] ) }
    / "'" chars:( !( "'"  / NEWLINE ) (ESCAPE / .) )* "'" { return chars.map( t => t[1] ) } 
  ) { return chars.map( c => (raw && c.rawVal) ? c.rawVal : c.toString()).join("") } 

BYTES_LIT = [bB] chars:STRING_LIT { 
	return Uint8Array.from(  chars.split("").map( c=>c.codePointAt(0) )  )
}

ESCAPE = "\\" eskey:$[bfnrt"'\\] {
      const strVal = ({
        'b': "\b",
        'f': "\f",
        'n': "\n",
        'r': "\r",
        't': "\t",
        '"': "\"",
        '\'': "\'",
        '\\': "\\"
      })[eskey]
      
	  const numVal = strVal.codePointAt(0)
      
      if(!eskey) throw "escape char error";
      return ({ 
          type: "escapeChar", 
          toString: () => strVal, 
          rawVal: text()
      })
    }
  / "\\" "u" hx:$(HEXDIGIT HEXDIGIT HEXDIGIT HEXDIGIT) { 
  		const numVal = parseInt(hx,16)
  		return ({ 
        	type: "escapeChar", 
            toString: () => String.fromCodePoint(numVal), 
            rawVal: text()
        }) 
     }
  / "\\" oct:$([0-3] [0-7] [0-7]) { 
  		const numVal = parseInt(oct,8)
  		return ({ 
        	type: "escapeChar", 
            toString: () => String.fromCodePoint(numVal), 
            rawVal: text()
        }) 
     }
     
NEWLINE        = [\r\n] / [\r] / [\n]
BOOL_LIT       = "true" / "false"
NULL_LIT       = "null"
RESERVED       = BOOL_LIT / NULL_LIT / "in"
                 / "as" / "break" / "const" / "continue" / "else"
                 / "for" / "function" / "if" / "import" / "let"
                 / "loop" / "package" / "namespace" / "return"
                 / "var" / "void" / "while"
WHITESPACE     = [\t\n\f\r ]*
COMMENT        = '//'
