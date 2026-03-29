import { drugCatalog } from "../data/drugCatalog";
import type {
  ClassDecision,
  DrugDecision,
  DrugDefinition,
  GraphEdge,
  GraphNode,
  PatientCase,
  RecommendationResult,
  RelationshipType,
  RuleAction,
  RuleHit,
} from "../types";

interface RuleDefinition {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
  weight: number;
  source: string;
  rationale: string;
  targetLabels: string[];
  relation: RelationshipType;
  getEvidence: (patientCase: PatientCase) => string[];
  matches: (patientCase: PatientCase) => boolean;
  targets: (drug: DrugDefinition) => boolean;
}

interface MutableDrugState extends DrugDecision {
  tags: string[];
}

const baseScore = 0.2;

const rules: RuleDefinition[] = [
  {
    ruleId: "R01",
    ruleName: "糖尿病伴蛋白尿优先 ACEI/ARB",
    action: "strong_confirm",
    weight: 1,
    source: "ADA / ESC",
    rationale: "糖尿病合并蛋白尿时，RAAS 抑制策略更契合肾脏保护目标。",
    targetLabels: ["ACEI", "ARB"],
    relation: "confirm",
    getEvidence: () => ["糖尿病", "蛋白尿/白蛋白尿"],
    matches: (patientCase) =>
      patientCase.diabetes.hasDiabetes && patientCase.diabetes.proteinuria,
    targets: (drug) => drug.tags.includes("acei") || drug.tags.includes("arb"),
  },
  {
    ruleId: "R02",
    ruleName: "CKD 伴蛋白尿优先 ACEI/ARB",
    action: "strong_confirm",
    weight: 1,
    source: "KDIGO / ESC",
    rationale: "CKD 合并蛋白尿时优先考虑 ACEI/ARB，以强化肾脏保护价值。",
    targetLabels: ["ACEI", "ARB"],
    relation: "confirm",
    getEvidence: () => ["CKD", "蛋白尿/白蛋白尿"],
    matches: (patientCase) =>
      patientCase.ckd.hasCkd && patientCase.ckd.proteinuria,
    targets: (drug) => drug.tags.includes("acei") || drug.tags.includes("arb"),
  },
  {
    ruleId: "R03",
    ruleName: "CKD 高钾时慎用 ACEI/ARB/MRA",
    action: "caution",
    weight: -0.4,
    source: "KDIGO",
    rationale: "高钾状态下继续强化 RAAS 抑制会提高电解质风险。",
    targetLabels: ["ACEI", "ARB", "MRA"],
    relation: "caution",
    getEvidence: (patientCase) => [
      "CKD",
      `血钾 ${patientCase.ckd.potassium || "待补充"} mmol/L`,
    ],
    matches: (patientCase) =>
      patientCase.ckd.hasCkd &&
      typeof patientCase.ckd.potassium === "number" &&
      patientCase.ckd.potassium >= 5,
    targets: (drug) =>
      drug.tags.includes("acei") ||
      drug.tags.includes("arb") ||
      drug.tags.includes("mra"),
  },
  {
    ruleId: "R04",
    ruleName: "已存在 ACEI + ARB 联合时排除重复 RAAS 强化",
    action: "exclude",
    weight: 0,
    source: "KDIGO",
    rationale: "ACEI 与 ARB 联合缺乏常规获益，且增加不良反应风险。",
    targetLabels: ["ACEI", "ARB"],
    relation: "exclude",
    getEvidence: () => ["当前 ACEI", "当前 ARB"],
    matches: (patientCase) =>
      patientCase.currentMedication.acei && patientCase.currentMedication.arb,
    targets: (drug) => drug.tags.includes("acei") || drug.tags.includes("arb"),
  },
  {
    ruleId: "R05",
    ruleName: "哮喘排除非选择性 β 阻滞剂",
    action: "exclude",
    weight: 0,
    source: "GINA",
    rationale: "哮喘场景下非选择性 β 阻滞剂更易诱发支气管痉挛。",
    targetLabels: ["普萘洛尔"],
    relation: "exclude",
    getEvidence: (patientCase) =>
      patientCase.asthma.recentAttack
        ? ["哮喘", "近期发作"]
        : ["哮喘"],
    matches: (patientCase) => patientCase.asthma.hasAsthma,
    targets: (drug) => drug.tags.includes("beta-nonselective"),
  },
  {
    ruleId: "R06A",
    ruleName: "痛风或高尿酸时慎用氢氯噻嗪",
    action: "caution",
    weight: -0.4,
    source: "ACR",
    rationale: "痛风和高尿酸患者应尽量避免进一步升高尿酸的利尿剂策略。",
    targetLabels: ["氢氯噻嗪"],
    relation: "caution",
    getEvidence: (patientCase) => {
      const evidence = [];
      if (patientCase.gout.hasGout) {
        evidence.push("痛风");
      }
      if (patientCase.gout.hyperuricemia) {
        evidence.push("高尿酸血症");
      }
      return evidence;
    },
    matches: (patientCase) =>
      patientCase.gout.hasGout || patientCase.gout.hyperuricemia,
    targets: (drug) => drug.id === "hydrochlorothiazide",
  },
  {
    ruleId: "R06B",
    ruleName: "痛风或高尿酸时优先氯沙坦",
    action: "confirm",
    weight: 0.6,
    source: "ACR",
    rationale: "氯沙坦在同类中更适合作为痛风场景的优先选择。",
    targetLabels: ["氯沙坦"],
    relation: "confirm",
    getEvidence: (patientCase) => {
      const evidence = [];
      if (patientCase.gout.hasGout) {
        evidence.push("痛风");
      }
      if (patientCase.gout.hyperuricemia) {
        evidence.push("高尿酸血症");
      }
      return evidence;
    },
    matches: (patientCase) =>
      patientCase.gout.hasGout || patientCase.gout.hyperuricemia,
    targets: (drug) => drug.id === "losartan",
  },
  {
    ruleId: "R07A",
    ruleName: "妊娠或备孕排除 ACEI/ARB",
    action: "exclude",
    weight: 0,
    source: "NICE",
    rationale: "妊娠或备孕时 ACEI/ARB 不作为推荐方案。",
    targetLabels: ["ACEI", "ARB"],
    relation: "exclude",
    getEvidence: (patientCase) =>
      patientCase.pregnancy.pregnant ? ["妊娠"] : ["备孕"],
    matches: (patientCase) =>
      patientCase.pregnancy.pregnant || patientCase.pregnancy.planning,
    targets: (drug) => drug.tags.includes("acei") || drug.tags.includes("arb"),
  },
  {
    ruleId: "R07B",
    ruleName: "妊娠或备孕优先拉贝洛尔/硝苯地平/甲基多巴",
    action: "confirm",
    weight: 0.6,
    source: "NICE",
    rationale: "妊娠场景优先考虑更常用的替代降压方案。",
    targetLabels: ["拉贝洛尔", "硝苯地平控释片", "甲基多巴"],
    relation: "confirm",
    getEvidence: (patientCase) =>
      patientCase.pregnancy.pregnant ? ["妊娠"] : ["备孕"],
    matches: (patientCase) =>
      patientCase.pregnancy.pregnant || patientCase.pregnancy.planning,
    targets: (drug) => drug.tags.includes("pregnancy-preferred"),
  },
  {
    ruleId: "R08",
    ruleName: "冠心病合并心绞痛支持 β 阻滞剂或 CCB",
    action: "confirm",
    weight: 0.6,
    source: "AHA / CCD",
    rationale: "慢性冠脉病合并心绞痛时，β 阻滞剂或 CCB 可作为抗心绞痛导向方案。",
    targetLabels: ["β 阻滞剂", "CCB"],
    relation: "confirm",
    getEvidence: () => ["冠心病", "心绞痛"],
    matches: (patientCase) => patientCase.cad.hasCad && patientCase.cad.angina,
    targets: (drug) =>
      drug.tags.includes("beta-blocker") || drug.tags.includes("ccb"),
  },
  {
    ruleId: "R09",
    ruleName: "心衰伴水肿时支持袢利尿剂",
    action: "confirm",
    weight: 0.6,
    source: "ACC HFrEF",
    rationale: "水肿和容量负荷提示需要利尿方向的辅助控制。",
    targetLabels: ["袢利尿剂"],
    relation: "confirm",
    getEvidence: () => ["心力衰竭", "水肿"],
    matches: (patientCase) =>
      patientCase.heartFailure.hasHeartFailure &&
      (patientCase.heartFailure.legEdema || patientCase.ckd.edema),
    targets: (drug) => drug.tags.includes("loop"),
  },
  {
    ruleId: "R10",
    ruleName: "当前已用 ACEI 时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["ACEI"],
    relation: "exclude",
    getEvidence: () => ["当前 ACEI"],
    matches: (patientCase) => patientCase.currentMedication.acei,
    targets: (drug) => drug.tags.includes("acei"),
  },
  {
    ruleId: "R11",
    ruleName: "当前已用 ARB 时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["ARB"],
    relation: "exclude",
    getEvidence: () => ["当前 ARB"],
    matches: (patientCase) => patientCase.currentMedication.arb,
    targets: (drug) => drug.tags.includes("arb"),
  },
  {
    ruleId: "R12",
    ruleName: "当前已用 CCB 时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["CCB"],
    relation: "exclude",
    getEvidence: () => ["当前 CCB"],
    matches: (patientCase) => patientCase.currentMedication.ccb,
    targets: (drug) => drug.tags.includes("ccb"),
  },
  {
    ruleId: "R13",
    ruleName: "当前已用噻嗪类时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["噻嗪类"],
    relation: "exclude",
    getEvidence: () => ["当前噻嗪类"],
    matches: (patientCase) => patientCase.currentMedication.thiazide,
    targets: (drug) => drug.tags.includes("thiazide"),
  },
  {
    ruleId: "R14",
    ruleName: "当前已用袢利尿剂时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["袢利尿剂"],
    relation: "exclude",
    getEvidence: () => ["当前袢利尿剂"],
    matches: (patientCase) => patientCase.currentMedication.loop,
    targets: (drug) => drug.tags.includes("loop"),
  },
  {
    ruleId: "R15",
    ruleName: "当前已用 β 阻滞剂时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["β 阻滞剂"],
    relation: "exclude",
    getEvidence: () => ["当前 β 阻滞剂"],
    matches: (patientCase) => patientCase.currentMedication.betaBlocker,
    targets: (drug) => drug.tags.includes("beta-blocker"),
  },
  {
    ruleId: "R16",
    ruleName: "当前已用 MRA 时排除同类重复推荐",
    action: "exclude",
    weight: 0,
    source: "系统去重",
    rationale: "初版原型避免继续输出同类重复推荐，突出联合方案思路。",
    targetLabels: ["MRA"],
    relation: "exclude",
    getEvidence: () => ["当前 MRA"],
    matches: (patientCase) => patientCase.currentMedication.mra,
    targets: (drug) => drug.tags.includes("mra"),
  },
  {
    ruleId: "R17",
    ruleName: "ACEI 咳嗽史时慎用 ACEI",
    action: "caution",
    weight: -0.4,
    source: "既往不良反应",
    rationale: "既往 ACEI 咳嗽史提示再次使用的耐受性风险。",
    targetLabels: ["ACEI"],
    relation: "caution",
    getEvidence: () => ["ACEI 咳嗽史"],
    matches: (patientCase) => patientCase.risk.aceiCough,
    targets: (drug) => drug.tags.includes("acei"),
  },
  {
    ruleId: "R18",
    ruleName: "HFrEF 支持循证 β 阻滞剂和 MRA",
    action: "confirm",
    weight: 0.6,
    source: "ACC HFrEF",
    rationale: "HFrEF 场景下 β 阻滞剂与 MRA 更符合疾病管理方向。",
    targetLabels: ["β 阻滞剂", "MRA"],
    relation: "confirm",
    getEvidence: () => ["心力衰竭", "HFrEF"],
    matches: (patientCase) =>
      patientCase.heartFailure.hasHeartFailure &&
      patientCase.heartFailure.type === "hfrEF",
    targets: (drug) =>
      drug.tags.includes("mra") ||
      drug.id === "metoprolol" ||
      drug.id === "bisoprolol" ||
      drug.id === "carvedilol",
  },
  {
    ruleId: "R19",
    ruleName: "ACEI/ARB/MRA 纳入监测建议",
    action: "monitor",
    weight: 0,
    source: "ADA / KDIGO",
    rationale: "RAAS 相关方案应结合肌酐和血钾动态监测。",
    targetLabels: ["ACEI", "ARB", "MRA"],
    relation: "monitor",
    getEvidence: () => ["RAAS 相关药物"],
    matches: () => true,
    targets: (drug) =>
      drug.tags.includes("acei") ||
      drug.tags.includes("arb") ||
      drug.tags.includes("mra"),
  },
  {
    ruleId: "R20",
    ruleName: "利尿剂纳入电解质监测",
    action: "monitor",
    weight: 0,
    source: "系统安全提示",
    rationale: "利尿剂使用后应关注电解质、容量状态和肾功能变化。",
    targetLabels: ["噻嗪类", "袢利尿剂"],
    relation: "monitor",
    getEvidence: () => ["利尿剂相关方案"],
    matches: () => true,
    targets: (drug) =>
      drug.tags.includes("thiazide") || drug.tags.includes("loop"),
  },
];

const getInputSummary = (patientCase: PatientCase): string[] => {
  const summary: string[] = [];

  if (patientCase.base.primaryHypertension) {
    summary.push("高血压");
  }

  if (patientCase.hypertension.uncontrolled) {
    summary.push("当前血压未控制");
  }

  if (patientCase.diabetes.hasDiabetes) {
    summary.push("糖尿病");
  }

  if (patientCase.diabetes.proteinuria || patientCase.ckd.proteinuria) {
    summary.push("蛋白尿/白蛋白尿");
  }

  if (patientCase.ckd.hasCkd) {
    summary.push("CKD");
  }

  if (patientCase.cad.hasCad) {
    summary.push(patientCase.cad.angina ? "冠心病伴心绞痛" : "冠心病");
  }

  if (patientCase.heartFailure.hasHeartFailure) {
    summary.push(
      patientCase.heartFailure.type === "hfrEF"
        ? "心衰 HFrEF"
        : patientCase.heartFailure.type === "hfpEF"
          ? "心衰 HFpEF"
          : "心力衰竭",
    );
  }

  if (patientCase.asthma.hasAsthma) {
    summary.push("哮喘");
  }

  if (patientCase.gout.hasGout || patientCase.gout.hyperuricemia) {
    summary.push(
      patientCase.gout.hasGout ? "痛风" : "高尿酸血症",
    );
  }

  if (patientCase.pregnancy.pregnant || patientCase.pregnancy.planning) {
    summary.push(patientCase.pregnancy.pregnant ? "妊娠" : "备孕");
  }

  if (patientCase.currentMedication.acei) {
    summary.push("当前 ACEI");
  }

  if (patientCase.currentMedication.arb) {
    summary.push("当前 ARB");
  }

  if (patientCase.currentMedication.ccb) {
    summary.push("当前 CCB");
  }

  if (patientCase.currentMedication.thiazide) {
    summary.push("当前噻嗪类");
  }

  if (patientCase.currentMedication.betaBlocker) {
    summary.push("当前 β 阻滞剂");
  }

  return summary;
};

const relationLabel = (action: RuleAction): RelationshipType => {
  if (action === "exclude") {
    return "exclude";
  }

  if (action === "caution") {
    return "caution";
  }

  if (action === "monitor") {
    return "monitor";
  }

  return "confirm";
};

export const runRecommendation = (
  patientCase: PatientCase,
): RecommendationResult => {
  const mutableDrugs: MutableDrugState[] = drugCatalog.map((drug) => ({
    id: drug.id,
    name: drug.name,
    classId: drug.classId,
    classLabel: drug.classLabel,
    score: baseScore,
    status: "neutral",
    reasons: [],
    tags: drug.tags,
  }));

  const ruleHits: RuleHit[] = [];
  const graphNodes = new Map<string, GraphNode>();
  const graphEdges = new Map<string, GraphEdge>();
  const monitorSuggestions = new Set<string>();

  drugCatalog.forEach((drug) => {
    graphNodes.set(`drug:${drug.id}`, {
      id: `drug:${drug.id}`,
      label: drug.name,
      type: "drug",
    });
  });

  rules.forEach((rule) => {
    if (!rule.matches(patientCase)) {
      return;
    }

    const evidence = rule.getEvidence(patientCase);
    const affectedDrugs = mutableDrugs.filter((drug) => {
      const definition = drugCatalog.find((item) => item.id === drug.id);
      return definition ? rule.targets(definition) : false;
    });

    if (affectedDrugs.length === 0) {
      return;
    }

    ruleHits.push({
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      action: rule.action,
      targetLabels: rule.targetLabels,
      weight: rule.weight,
      source: rule.source,
      rationale: rule.rationale,
      evidence,
    });

    graphNodes.set(`rule:${rule.ruleId}`, {
      id: `rule:${rule.ruleId}`,
      label: `${rule.ruleId} ${rule.ruleName}`,
      type: "rule",
    });

    evidence.forEach((item) => {
      graphNodes.set(`feature:${item}`, {
        id: `feature:${item}`,
        label: item,
        type: "feature",
      });
      graphEdges.set(`feature:${item}->rule:${rule.ruleId}`, {
        id: `feature:${item}->rule:${rule.ruleId}`,
        source: `feature:${item}`,
        target: `rule:${rule.ruleId}`,
        relation: "monitor",
        weight: 0.2,
      });
    });

    affectedDrugs.forEach((drug) => {
      if (rule.action === "exclude") {
        drug.status = "excluded";
      } else if (rule.action === "caution" && drug.status !== "excluded") {
        drug.status = "caution";
        drug.score += rule.weight;
      } else if (
        (rule.action === "confirm" || rule.action === "strong_confirm") &&
        drug.status !== "excluded"
      ) {
        drug.score += rule.weight;
        if (drug.status === "neutral") {
          drug.status = "recommended";
        }
      }

      if (rule.action === "monitor") {
        const catalogDrug = drugCatalog.find((item) => item.id === drug.id);
        catalogDrug?.monitoring.forEach((item) => monitorSuggestions.add(item));
      }

      drug.reasons.push(`${rule.ruleId} ${rule.ruleName}`);

      graphEdges.set(`rule:${rule.ruleId}->drug:${drug.id}`, {
        id: `rule:${rule.ruleId}->drug:${drug.id}`,
        source: `rule:${rule.ruleId}`,
        target: `drug:${drug.id}`,
        relation: relationLabel(rule.action),
        weight: Math.max(Math.abs(rule.weight), 0.3),
      });
    });
  });

  mutableDrugs.forEach((drug) => {
    if (drug.status !== "excluded" && drug.score > baseScore + 0.01) {
      drug.status = drug.status === "caution" ? "caution" : "recommended";
    }
    if (drug.status === "neutral" && drug.score < 0) {
      drug.status = "caution";
    }
  });

  const grouped = new Map<string, ClassDecision>();

  mutableDrugs
    .filter((drug) => drug.status !== "excluded")
    .forEach((drug) => {
      const previous = grouped.get(drug.classId);
      if (!previous) {
        grouped.set(drug.classId, {
          classId: drug.classId,
          classLabel: drug.classLabel,
          score: drug.score,
          drugs: [drug.name],
          reasons: [...drug.reasons],
        });
        return;
      }

      previous.score = Math.max(previous.score, drug.score);
      previous.drugs = Array.from(new Set([...previous.drugs, drug.name]));
      previous.reasons = Array.from(new Set([...previous.reasons, ...drug.reasons]));
    });

  const topClasses = Array.from(grouped.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const topDrugs = mutableDrugs
    .filter((drug) => drug.status !== "excluded")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const excludedDrugs = mutableDrugs
    .filter((drug) => drug.status === "excluded")
    .sort((a, b) => a.classLabel.localeCompare(b.classLabel));

  const cautionDrugs = mutableDrugs
    .filter((drug) => drug.status === "caution")
    .sort((a, b) => b.score - a.score);

  return {
    inputSummary: getInputSummary(patientCase),
    topClasses,
    topDrugs,
    excludedDrugs,
    cautionDrugs,
    monitorSuggestions: Array.from(monitorSuggestions),
    ruleHits,
    graphNodes: Array.from(graphNodes.values()),
    graphEdges: Array.from(graphEdges.values()),
  };
};
