import * as React from "react";

type Props = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  titleSuffix?: React.ReactNode;
  children?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, titleSuffix, children }: Props) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 className="page-title">
          {title}
          {titleSuffix && <span className="page-title-suffix"> — {titleSuffix}</span>}
        </h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
