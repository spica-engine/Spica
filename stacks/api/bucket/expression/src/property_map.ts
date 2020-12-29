import {getMostLeftSelectIdentifier} from "./ast";

function visit(node) {
  switch (node.kind) {
    case "operator":
      return visitNode(node);
    case "identifier":
      return visitIdentifier(node);
    case "call":
      return visitNode(node.arguments[0]);
    case "unary":
      return visitUnary(node);
  }
}

function visitIdentifier(node) {
  return node.name;
}

function visitUnary(node) {
  switch (node.type) {
    case "not":
      return visitUnaryNot(node);
    default:
      throw new Error(`invalid unary kind ${node.kind}`);
  }
}

function visitUnaryNot(node) {
  return visit(node.member);
}

function visitBinaryOperatorSelect(node) {
  const left = visit(node.left);

  const mostLeft = getMostLeftSelectIdentifier(node);

  if (mostLeft == "auth") {
    return undefined;
  }

  const right = visit(node.right);

  let path = `${left}.${right}`;

  if (left == "document") {
    path = right;
  }

  return path;
}

function visitNode(node) {
  if (node.kind == "operator" && node.type == "select") {
    const result = visitBinaryOperatorSelect(node);
    return result ? [result] : [];
  }
  const left = visit(node.left);
  const right = visit(node.right);
  const result = [];

  if (left) {
    if (Array.isArray(left)) {
      result.push(...left);
    } else {
      result.push(left);
    }
  }

  if (right) {
    if (Array.isArray(right)) {
      result.push(...right);
    } else {
      result.push(right);
    }
  }

  return result;
}

export const extract = node => {
  return Array.from<string>(new Set(visit(node)));
};
