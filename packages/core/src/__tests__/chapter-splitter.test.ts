import { describe, expect, it } from "vitest";
import { splitChapters, groupChaptersByVolume } from "../utils/chapter-splitter.js";

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

  // ── Act (幕) splitting ──

  it("splits by 第X幕 headings by default", () => {
    const input = [
      "第一幕 卡塞尔之门",
      "",
      "路明非在屏幕上无奈地打出GG。",
      "",
      "第二幕 神秘的学院",
      "",
      "这是一所位于美国伊利诺伊州的私立大学。",
      "",
      "第三幕 自由一日",
      "",
      "所有人看向外面。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(3);
    expect(chapters[0]?.title).toBe("卡塞尔之门");
    expect(chapters[0]?.content).toBe("路明非在屏幕上无奈地打出GG。");
    expect(chapters[1]?.title).toBe("神秘的学院");
    expect(chapters[1]?.content).toBe("这是一所位于美国伊利诺伊州的私立大学。");
    expect(chapters[2]?.title).toBe("自由一日");
    expect(chapters[2]?.content).toBe("所有人看向外面。");
  });

  it("uses a 第N幕 fallback title when act heading has no title text", () => {
    const input = [
      "第一幕",
      "",
      "正文内容。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("第1幕");
  });

  it("splits by 第X幕 headings with Chinese numerals", () => {
    const input = [
      "第七幕 星与花",
      "",
      "星辰在夜空中闪烁。",
      "",
      "第十幕 七宗罪",
      "",
      "审判即将开始。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.title).toBe("星与花");
    expect(chapters[0]?.content).toBe("星辰在夜空中闪烁。");
    expect(chapters[1]?.title).toBe("七宗罪");
    expect(chapters[1]?.content).toBe("审判即将开始。");
  });

  // ── Section (节) splitting ──

  it("splits by 第X节 headings by default", () => {
    const input = [
      "第一节 穿越",
      "",
      "林轩睁开眼睛，发现自己躺在一片陌生的森林中。",
      "",
      "第二节 遭遇魔兽",
      "",
      "突然，一声咆哮从密林深处传来。",
      "",
      "第三节 绝境求生",
      "",
      "林轩咬紧牙关，握紧了手中的木棍。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(3);
    expect(chapters[0]?.title).toBe("穿越");
    expect(chapters[0]?.content).toBe("林轩睁开眼睛，发现自己躺在一片陌生的森林中。");
    expect(chapters[1]?.title).toBe("遭遇魔兽");
    expect(chapters[1]?.content).toBe("突然，一声咆哮从密林深处传来。");
    expect(chapters[2]?.title).toBe("绝境求生");
    expect(chapters[2]?.content).toBe("林轩咬紧牙关，握紧了手中的木棍。");
  });

  it("uses a 第N节 fallback title when section heading has no title text", () => {
    const input = [
      "第一节",
      "",
      "正文内容。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe("第1节");
  });

  it("splits by traditional Chinese 第X節 headings", () => {
    const input = [
      "第一節 起因",
      "",
      "話說天下大勢，分久必合。",
      "",
      "第二節 經過",
      "",
      "且說那日之後，局勢驟變。",
    ].join("\n");

    const chapters = splitChapters(input);

    expect(chapters).toHaveLength(2);
    expect(chapters[0]?.title).toBe("起因");
    expect(chapters[1]?.title).toBe("經過");
  });

  // ── Volume detection ──

  it("groupChaptersByVolume detects single volume when no markers present", () => {
    const chapters = [
      { title: "第一章", content: "内容" },
      { title: "第二章", content: "内容" },
      { title: "第三章", content: "内容" },
    ];

    const volumes = groupChaptersByVolume(chapters);

    expect(volumes).toHaveLength(1);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[0]?.chapterCount).toBe(3);
  });

  it("groupChaptersByVolume detects volume markers in chapter titles", () => {
    const chapters = [
      { title: "第一卷 觉醒", content: "序幕内容" },
      { title: "第一章 启程", content: "内容" },
      { title: "第二章 相遇", content: "内容" },
      { title: "第二卷 成长", content: "内容" },
      { title: "第三章 修炼", content: "内容" },
      { title: "第四章 突破", content: "内容" },
    ];

    const volumes = groupChaptersByVolume(chapters);

    expect(volumes).toHaveLength(2);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[0]?.title).toBe("觉醒");
    expect(volumes[0]?.chapterCount).toBe(3);
    expect(volumes[1]?.volumeNumber).toBe(2);
    expect(volumes[1]?.title).toBe("成长");
    expect(volumes[1]?.chapterCount).toBe(3);
  });

  it("groupChaptersByVolume detects volume markers in chapter content", () => {
    const chapters = [
      { title: "", content: "第一卷 风起\n\n这是第一章的内容。" },
      { title: "", content: "这是第二章的内容。" },
      { title: "", content: "第二卷 云涌\n\n这是第三章的内容。" },
    ];

    const volumes = groupChaptersByVolume(chapters);

    expect(volumes).toHaveLength(2);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[0]?.chapterCount).toBe(2);
    expect(volumes[1]?.volumeNumber).toBe(2);
    expect(volumes[1]?.chapterCount).toBe(1);
  });

  it("groupChaptersByVolume with rawText detects standalone volume markers in preamble", () => {
    const rawText = [
      "序言内容...",
      "",
      "第一卷",
      "魔性不改",
      "第一节 觉醒",
      "故事开始。",
      "",
      "第二节 出发",
      "踏上旅程。",
      "",
      "第二卷",
      "魔子出山",
      "第一节 新篇章",
      "新的开始。",
    ].join("\n");

    const chapters = [
      { title: "觉醒", content: "故事开始。" },
      { title: "出发", content: "踏上旅程。" },
      { title: "新篇章", content: "新的开始。" },
    ];

    const volumes = groupChaptersByVolume(chapters, rawText);

    expect(volumes).toHaveLength(2);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[0]?.title).toBe("魔性不改");
    expect(volumes[0]?.chapterCount).toBe(2);
    expect(volumes[1]?.volumeNumber).toBe(2);
    expect(volumes[1]?.title).toBe("魔子出山");
    expect(volumes[1]?.chapterCount).toBe(1);
  });

  it("groupChaptersByVolume without rawText still detects inline volume markers", () => {
    const chapters = [
      { title: "第一卷 觉醒", content: "故事开始。" },
      { title: "第一章", content: "出发。" },
      { title: "第二卷 风云", content: "新的开始。" },
    ];

    const volumes = groupChaptersByVolume(chapters);

    expect(volumes).toHaveLength(2);
    expect(volumes[0]?.volumeNumber).toBe(1);
    expect(volumes[0]?.chapterCount).toBe(2);
    expect(volumes[1]?.volumeNumber).toBe(2);
    expect(volumes[1]?.chapterCount).toBe(1);
  });
});
