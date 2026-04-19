import React, { useMemo } from 'react';

function toSafeHref(rawHref: string | null): string | null {
  if (!rawHref) {
    return null;
  }
  try {
    const parsed = new URL(rawHref);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function renderNodes(nodes: NodeListOf<ChildNode> | ChildNode[]): React.ReactNode[] {
  return Array.from(nodes).map((node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return <React.Fragment key={index}>{node.textContent ?? ''}</React.Fragment>;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const childNodes = renderNodes(element.childNodes);
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') {
      return <br key={index} />;
    }
    if (tagName === 'strong') {
      return <strong key={index}>{childNodes}</strong>;
    }
    if (tagName === 'code') {
      return <code key={index}>{childNodes}</code>;
    }
    if (tagName === 'a') {
      const safeHref = toSafeHref(element.getAttribute('href'));
      if (!safeHref) {
        return <React.Fragment key={index}>{childNodes}</React.Fragment>;
      }
      return (
        <a key={index} href={safeHref} rel="noopener noreferrer">
          {childNodes}
        </a>
      );
    }

    return <React.Fragment key={index}>{childNodes}</React.Fragment>;
  });
}

interface SafeRichTextProps {
  readonly className?: string;
  readonly content: string;
}

export function SafeRichText({ className, content }: SafeRichTextProps) {
  const nodes = useMemo(() => {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(content, 'text/html');
    return renderNodes(parsed.body.childNodes);
  }, [content]);

  return <div className={className}>{nodes}</div>;
}
