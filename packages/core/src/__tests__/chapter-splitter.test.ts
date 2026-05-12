import { describe, expect, it } from "vitest";
import { splitChapters } from "../utils/chapter-splitter.js";

describe("splitChapters", () => {
  it("splits classical Chinese chapter headings with 第X回 by default", () => {
    const input = [
      "第一回：宴桃園豪傑三結義，斬黃巾英雄首立功",
      "",
      "滾滾長江東逝水，浪花淘盡英雄。",
      "",
      "第二回：張翼德怒鞭督郵，何國舅謀誅宦豎",
      "",
      "且說董卓專權，朝野震動。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({
      title: "宴桃園豪傑三結義，斬黃巾英雄首立功",
      content: "滾滾長江東逝水，浪花淘盡英雄。",
    });
    expect(chapters[1]).toEqual({
      title: "張翼德怒鞭督郵，何國舅謀誅宦豎",
      content: "且說董卓專權，朝野震動。",
    });
  });

  it("uses a 第N回 fallback title when a classical Chinese heading has no title text", () => {
    const input = [
      "第一回",
      "",
      "天下大勢，分久必合，合久必分。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("第1回");
  });

  it("splits classical Chinese headings that use the round-zero numeral form", () => {
    const input = [
      "第九十九回：孔明秋雨退魏兵",
      "",
      "未知孔明怎生破魏，且看下文分解。",
      "",
      "第一○○回：漢兵劫寨破曹真，武侯鬥陣辱仲達",
      "",
      "卻說眾將聞孔明不追魏兵，俱入帳告曰。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({
      title: "孔明秋雨退魏兵",
      content: "未知孔明怎生破魏，且看下文分解。",
    });
    expect(chapters[1]).toEqual({
      title: "漢兵劫寨破曹真，武侯鬥陣辱仲達",
      content: "卻說眾將聞孔明不追魏兵，俱入帳告曰。",
    });
  });

  it("splits English chapter headings with the default pattern", () => {
    const input = [
      "Chapter 1: Prelude",
      "",
      "The harbor bells rang before dawn.",
      "",
      "Chapter 2: Into the Fog",
      "",
      "Mara followed the last lantern into the mist.",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({
      title: "Prelude",
      content: "The harbor bells rang before dawn.",
    });
    expect(chapters[1]).toEqual({
      title: "Into the Fog",
      content: "Mara followed the last lantern into the mist.",
    });
  });

  it("uses an English fallback title when the chapter heading has no title text", () => {
    const input = [
      "Chapter 1",
      "",
      "The harbor bells rang before dawn.",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("Chapter 1");
  });

  it("splits Roman numeral English chapter headings with the default pattern", () => {
    const input = [
      "CHAPTER I.",
      "",
      "The harbor bells rang before dawn.",
      "",
      "CHAPTER II.",
      "",
      "Mara followed the last lantern into the mist.",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]).toEqual({
      title: "Chapter 1",
      content: "The harbor bells rang before dawn.",
    });
    expect(chapters[1]).toEqual({
      title: "Chapter 2",
      content: "Mara followed the last lantern into the mist.",
    });
  });

  it("keeps English fallback titles when a custom regex matches Roman numeral headings", () => {
    const input = [
      "CHAPTER I.",
      "",
      "The harbor bells rang before dawn.",
    ].join("\n");

    const chapters = splitChapters(input, "^CHAPTER\\s+[IVXLCDM]+\\.$");

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("Chapter 1");
  });

  it("strips a Project Gutenberg trailer from the final chapter content", () => {
    const input = [
      "Chapter 1: Finale",
      "",
      "The harbor bells rang once and went silent.",
      "",
      "Project Gutenberg™ depends upon and cannot survive without widespread",
      "public support and donations to carry out its mission.",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).toBe("The harbor bells rang once and went silent.");
    expect(chapters[0]?.content).not.toContain("Project Gutenberg");
  });

  // ── New: bare chapter number headings ──

  it("splits bare numeric chapter headings without 第 prefix", () => {
    const input = [
      "1188章巧合",
      "",
      "杨洛笑着说道。",
      "",
      "1189章屠狗",
      "",
      "郑达民低沉的喊了一声。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.title).toBe("巧合");
    expect(chapters[0]?.content).toBe("杨洛笑着说道。");
    expect(chapters[1]?.title).toBe("屠狗");
    expect(chapters[1]?.content).toBe("郑达民低沉的喊了一声。");
  });

  it("splits bare numeric chapter headings with space after 章", () => {
    const input = [
      "001章引子",
      "",
      "这是开头。",
      "",
      "002章韩国美女",
      "",
      "韩国汉城。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.title).toBe("引子");
    expect(chapters[1]?.title).toBe("韩国美女");
  });

  // ── New: noise cleaning ──

  it("removes advertisement recommendation lines", () => {
    const input = [
      "第一章 测试",
      "",
      "推荐好文：《超级学生》作者：公子诺。《极品美女的贴身保镖》作者：飞哥带路。《风流官王》作者：万年九眼。",
      "",
      "正文内容在这里。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("推荐好文");
    expect(chapters[0]?.content).not.toContain("超级学生");
    expect(chapters[0]?.content).toContain("正文内容在这里。");
  });

  it("removes HTML entity-encoded links from prose", () => {
    const input = [
      "第一章 测试",
      "",
      "同志TXT下载&lt;a href=&quot; target=&quot;_blank&quot;&gt;首席御医&lt;/a&gt;！",
      "",
      "正文继续。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("TXT下载");
    expect(chapters[0]?.content).not.toContain("&lt;a");
    expect(chapters[0]?.content).toContain("正文继续。");
  });

  it("removes embedded watermark phrases from prose lines", () => {
    const input = [
      "第一章 测试",
      "",
      "杨洛启动车子来到工厂。寻找最快更新网站，请百度搜索+看书网",
      "",
      "红旗酒店已经封锁。寻找最快更新网站，请百度搜索+看书网",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("百度搜索");
    expect(chapters[0]?.content).not.toContain("看书网");
    expect(chapters[0]?.content).toContain("杨洛启动车子来到工厂。");
    expect(chapters[0]?.content).toContain("红旗酒店已经封锁。");
  });

  it("removes separator lines and trailing > garbage", () => {
    const input = [
      "第一章 测试",
      "",
      "------------",
      "",
      "正文内容。",
      "",
      "&gt;，",
      "",
      "更多正文。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("----");
    expect(chapters[0]?.content).not.toContain("&gt;");
    expect(chapters[0]?.content).toContain("正文内容。");
    expect(chapters[0]?.content).toContain("更多正文。");
  });

  it("removes piracy site boilerplate lines", () => {
    const input = [
      "第一章 测试",
      "",
      "无弹窗",
      "",
      "天才一秒钟记住本站",
      "",
      "正文内容。",
      "",
      "手机版阅读网址：m.xxx.com",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("无弹窗");
    expect(chapters[0]?.content).not.toContain("天才一秒钟");
    expect(chapters[0]?.content).not.toContain("手机版阅读");
    expect(chapters[0]?.content).toContain("正文内容。");
  });

  it("cleans |三八文学 watermark from prose", () => {
    const input = [
      "第一章 测试",
      "",
      "杨洛没有理他消失在楼梯口。|三八文学",
      "",
      "来到房间，欧阳情焦急的说道。|三八文学",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("三八文学");
    expect(chapters[0]?.content).toContain("杨洛没有理他消失在楼梯口。");
    expect(chapters[0]?.content).toContain("来到房间，欧阳情焦急的说道。");
  });

  it("removes A ，最快更新 prefix from chapter openings", () => {
    const input = [
      "第一章 测试",
      "",
      "A ，最快更新特种兵在都市最新章节！",
      "",
      "杨洛拍拍肩膀。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.content).not.toContain("最快更新");
    expect(chapters[0]?.content).toContain("杨洛拍拍肩膀。");
  });
});
