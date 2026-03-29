import { useMemo, useState } from "react";
import {
  Activity,
  BookHeart,
  BrainCircuit,
  FlaskConical,
  HeartPulse,
  Network,
  Save,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { createEmptyCase, sampleCases } from "./data/sampleCases";
import { runRecommendation } from "./engine/recommendation";
import type {
  GraphEdge,
  GraphNode,
  PatientCase,
  RecommendationResult,
} from "./types";

type TabKey = "intake" | "results" | "graph";
type SectionKey = Exclude<keyof PatientCase, "id" | "createdAt">;

const STORAGE_KEY = "medicine-saved-cases";

const loadSavedCases = (): PatientCase[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as PatientCase[];
  } catch {
    return [];
  }
};

const persistSavedCases = (cases: PatientCase[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const relationColor: Record<GraphEdge["relation"], string> = {
  confirm: "#7cffc5",
  exclude: "#ff6b81",
  caution: "#ffd166",
  monitor: "#77a8ff",
};

function App() {
  const [caseData, setCaseData] = useState<PatientCase>(createEmptyCase);
  const [savedCases, setSavedCases] = useState<PatientCase[]>(loadSavedCases);
  const [result, setResult] = useState<RecommendationResult | null>(() =>
    runRecommendation(createEmptyCase()),
  );
  const [activeTab, setActiveTab] = useState<TabKey>("intake");

  const comorbidityCount = useMemo(
    () =>
      [
        caseData.diabetes.hasDiabetes,
        caseData.ckd.hasCkd,
        caseData.cad.hasCad,
        caseData.heartFailure.hasHeartFailure,
        caseData.asthma.hasAsthma,
        caseData.gout.hasGout || caseData.gout.hyperuricemia,
        caseData.pregnancy.pregnant || caseData.pregnancy.planning,
      ].filter(Boolean).length,
    [caseData],
  );

  const updateSection = <K extends SectionKey>(
    section: K,
    patch: Partial<PatientCase[K]>,
  ) => {
    setCaseData((previous) => ({
      ...previous,
      [section]: {
        ...previous[section],
        ...patch,
      },
    }));
  };

  const runDecision = () => {
    setResult(runRecommendation(caseData));
    setActiveTab("results");
  };

  const saveCase = () => {
    const nextCase = {
      ...caseData,
      createdAt: new Date().toISOString(),
    };
    const next = [
      nextCase,
      ...savedCases.filter((item) => item.id !== caseData.id).slice(0, 11),
    ];
    setSavedCases(next);
    persistSavedCases(next);
    setCaseData(nextCase);
  };

  const resetCase = () => {
    const emptyCase = createEmptyCase();
    setCaseData(emptyCase);
    setResult(runRecommendation(emptyCase));
    setActiveTab("intake");
  };

  const loadCase = (target: PatientCase) => {
    const cloned = JSON.parse(JSON.stringify(target)) as PatientCase;
    setCaseData(cloned);
    setResult(runRecommendation(cloned));
    setActiveTab("intake");
  };

  return (
    <div className="page-shell">
      <div className="background-orb background-orb-a" />
      <div className="background-orb background-orb-b" />
      <div className="app-container">
        <header className="hero-card">
          <div>
            <span className="eyebrow">医学人工智能课程原型</span>
            <h1>高血压共病辅助用药决策系统</h1>
            <p className="hero-copy">
              以规则引擎驱动候选药物筛选、冲突排除和解释展示，聚焦基层场景下的高血压合并多共病初步决策。
            </p>
          </div>
          <div className="hero-stats">
            <StatCard
              icon={<HeartPulse size={18} />}
              label="当前血压"
              value={`${caseData.hypertension.sbp || "--"} / ${caseData.hypertension.dbp || "--"}`}
            />
            <StatCard
              icon={<BrainCircuit size={18} />}
              label="共病数量"
              value={`${comorbidityCount}`}
            />
            <StatCard
              icon={<Sparkles size={18} />}
              label="命中规则"
              value={`${result?.ruleHits.length || 0}`}
            />
          </div>
        </header>

        <nav className="tab-bar">
          <TabButton
            active={activeTab === "intake"}
            icon={<Stethoscope size={16} />}
            label="首诊录入"
            onClick={() => setActiveTab("intake")}
          />
          <TabButton
            active={activeTab === "results"}
            icon={<BookHeart size={16} />}
            label="推荐结果"
            onClick={() => setActiveTab("results")}
          />
          <TabButton
            active={activeTab === "graph"}
            icon={<Network size={16} />}
            label="解释图谱"
            onClick={() => setActiveTab("graph")}
          />
        </nav>

        {activeTab === "intake" && (
          <div className="content-grid">
            <main className="stack">
              <div className="action-row">
                <button className="primary-button" onClick={runDecision}>
                  <Activity size={16} />
                  运行推理
                </button>
                <button className="secondary-button" onClick={saveCase}>
                  <Save size={16} />
                  保存病例
                </button>
                <button className="ghost-button" onClick={resetCase}>
                  新建病例
                </button>
              </div>

              <SectionCard
                title="基础信息"
                subtitle="采集患者概况，生成结构化首诊画像"
              >
                <div className="field-grid two-columns">
                  <TextField
                    label="病例名称"
                    value={caseData.base.patientName}
                    onChange={(value) =>
                      updateSection("base", { patientName: value })
                    }
                  />
                  <SelectField
                    label="性别"
                    value={caseData.base.sex}
                    options={[
                      { label: "男", value: "male" },
                      { label: "女", value: "female" },
                    ]}
                    onChange={(value) =>
                      updateSection("base", {
                        sex: value as PatientCase["base"]["sex"],
                      })
                    }
                  />
                  <NumberField
                    label="年龄"
                    value={caseData.base.age}
                    onChange={(value) => updateSection("base", { age: value })}
                  />
                  <NumberField
                    label="体重 kg"
                    value={caseData.base.weight}
                    onChange={(value) =>
                      updateSection("base", { weight: value })
                    }
                  />
                  <NumberField
                    label="身高 cm"
                    value={caseData.base.height}
                    onChange={(value) =>
                      updateSection("base", { height: value })
                    }
                  />
                  <ToggleField
                    label="主病为高血压"
                    checked={caseData.base.primaryHypertension}
                    onChange={(value) =>
                      updateSection("base", { primaryHypertension: value })
                    }
                  />
                  <ToggleField
                    label="吸烟史"
                    checked={caseData.base.smoking}
                    onChange={(value) =>
                      updateSection("base", { smoking: value })
                    }
                  />
                  <ToggleField
                    label="饮酒史"
                    checked={caseData.base.drinking}
                    onChange={(value) =>
                      updateSection("base", { drinking: value })
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="高血压主病信息"
                subtitle="判断是否进入加药或调整方案场景"
              >
                <div className="field-grid two-columns">
                  <NumberField
                    label="收缩压 SBP"
                    value={caseData.hypertension.sbp}
                    onChange={(value) =>
                      updateSection("hypertension", { sbp: value })
                    }
                  />
                  <NumberField
                    label="舒张压 DBP"
                    value={caseData.hypertension.dbp}
                    onChange={(value) =>
                      updateSection("hypertension", { dbp: value })
                    }
                  />
                  <ToggleField
                    label="已确诊高血压"
                    checked={caseData.hypertension.diagnosed}
                    onChange={(value) =>
                      updateSection("hypertension", { diagnosed: value })
                    }
                  />
                  <ToggleField
                    label="当前血压未控制"
                    checked={caseData.hypertension.uncontrolled}
                    onChange={(value) =>
                      updateSection("hypertension", { uncontrolled: value })
                    }
                  />
                  <ToggleField
                    label="已在服用降压药"
                    checked={caseData.hypertension.onMedication}
                    onChange={(value) =>
                      updateSection("hypertension", { onMedication: value })
                    }
                  />
                  <NumberField
                    label="当前降压药种数"
                    value={caseData.hypertension.medicationCount}
                    onChange={(value) =>
                      updateSection("hypertension", { medicationCount: value })
                    }
                  />
                  <ToggleField
                    label="怀疑难治性高血压"
                    checked={caseData.hypertension.resistantSuspected}
                    onChange={(value) =>
                      updateSection("hypertension", {
                        resistantSuspected: value,
                      })
                    }
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="平行共病模块"
                subtitle="围绕 7 类核心共病触发规则和安全提示"
              >
                <div className="parallel-grid">
                  <SubPanel title="糖尿病">
                    <ToggleField
                      label="合并糖尿病"
                      checked={caseData.diabetes.hasDiabetes}
                      onChange={(value) =>
                        updateSection("diabetes", { hasDiabetes: value })
                      }
                    />
                    <SelectField
                      label="类型"
                      value={caseData.diabetes.diabetesType}
                      options={[
                        { label: "1 型", value: "type1" },
                        { label: "2 型", value: "type2" },
                        { label: "不详", value: "unknown" },
                      ]}
                      onChange={(value) =>
                        updateSection("diabetes", {
                          diabetesType:
                            value as PatientCase["diabetes"]["diabetesType"],
                        })
                      }
                    />
                    <NumberField
                      label="HbA1c"
                      value={caseData.diabetes.hba1c}
                      onChange={(value) =>
                        updateSection("diabetes", { hba1c: value })
                      }
                    />
                    <ToggleField
                      label="蛋白尿 / 白蛋白尿"
                      checked={caseData.diabetes.proteinuria}
                      onChange={(value) =>
                        updateSection("diabetes", { proteinuria: value })
                      }
                    />
                    <ToggleField
                      label="糖尿病肾病"
                      checked={caseData.diabetes.diabeticNephropathy}
                      onChange={(value) =>
                        updateSection("diabetes", {
                          diabeticNephropathy: value,
                        })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="CKD">
                    <ToggleField
                      label="合并 CKD"
                      checked={caseData.ckd.hasCkd}
                      onChange={(value) =>
                        updateSection("ckd", { hasCkd: value })
                      }
                    />
                    <NumberField
                      label="eGFR"
                      value={caseData.ckd.egfr}
                      onChange={(value) =>
                        updateSection("ckd", { egfr: value })
                      }
                    />
                    <NumberField
                      label="血肌酐"
                      value={caseData.ckd.creatinine}
                      onChange={(value) =>
                        updateSection("ckd", { creatinine: value })
                      }
                    />
                    <NumberField
                      label="血钾"
                      value={caseData.ckd.potassium}
                      onChange={(value) =>
                        updateSection("ckd", { potassium: value })
                      }
                    />
                    <ToggleField
                      label="蛋白尿 / 白蛋白尿"
                      checked={caseData.ckd.proteinuria}
                      onChange={(value) =>
                        updateSection("ckd", { proteinuria: value })
                      }
                    />
                    <ToggleField
                      label="近期肾功能恶化"
                      checked={caseData.ckd.recentWorsening}
                      onChange={(value) =>
                        updateSection("ckd", { recentWorsening: value })
                      }
                    />
                    <ToggleField
                      label="水肿"
                      checked={caseData.ckd.edema}
                      onChange={(value) =>
                        updateSection("ckd", { edema: value })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="冠心病 / 心绞痛">
                    <ToggleField
                      label="合并冠心病"
                      checked={caseData.cad.hasCad}
                      onChange={(value) =>
                        updateSection("cad", { hasCad: value })
                      }
                    />
                    <ToggleField
                      label="有心绞痛"
                      checked={caseData.cad.angina}
                      onChange={(value) =>
                        updateSection("cad", { angina: value })
                      }
                    />
                    <ToggleField
                      label="既往心肌梗死"
                      checked={caseData.cad.previousMi}
                      onChange={(value) =>
                        updateSection("cad", { previousMi: value })
                      }
                    />
                    <NumberField
                      label="当前心率"
                      value={caseData.cad.heartRate}
                      onChange={(value) =>
                        updateSection("cad", { heartRate: value })
                      }
                    />
                    <ToggleField
                      label="已在用 β 阻滞剂"
                      checked={caseData.cad.onBetaBlocker}
                      onChange={(value) =>
                        updateSection("cad", { onBetaBlocker: value })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="心力衰竭">
                    <ToggleField
                      label="合并心衰"
                      checked={caseData.heartFailure.hasHeartFailure}
                      onChange={(value) =>
                        updateSection("heartFailure", {
                          hasHeartFailure: value,
                        })
                      }
                    />
                    <SelectField
                      label="心衰类型"
                      value={caseData.heartFailure.type}
                      options={[
                        { label: "HFrEF", value: "hfrEF" },
                        { label: "HFpEF", value: "hfpEF" },
                        { label: "不详", value: "unknown" },
                      ]}
                      onChange={(value) =>
                        updateSection("heartFailure", {
                          type: value as PatientCase["heartFailure"]["type"],
                        })
                      }
                    />
                    <NumberField
                      label="LVEF"
                      value={caseData.heartFailure.lvef}
                      onChange={(value) =>
                        updateSection("heartFailure", { lvef: value })
                      }
                    />
                    <ToggleField
                      label="下肢水肿"
                      checked={caseData.heartFailure.legEdema}
                      onChange={(value) =>
                        updateSection("heartFailure", { legEdema: value })
                      }
                    />
                    <ToggleField
                      label="呼吸困难"
                      checked={caseData.heartFailure.dyspnea}
                      onChange={(value) =>
                        updateSection("heartFailure", { dyspnea: value })
                      }
                    />
                    <ToggleField
                      label="已用 β 阻滞剂"
                      checked={caseData.heartFailure.onBetaBlocker}
                      onChange={(value) =>
                        updateSection("heartFailure", {
                          onBetaBlocker: value,
                        })
                      }
                    />
                    <ToggleField
                      label="已用 MRA"
                      checked={caseData.heartFailure.onMra}
                      onChange={(value) =>
                        updateSection("heartFailure", { onMra: value })
                      }
                    />
                    <ToggleField
                      label="已用袢利尿剂"
                      checked={caseData.heartFailure.onLoopDiuretic}
                      onChange={(value) =>
                        updateSection("heartFailure", {
                          onLoopDiuretic: value,
                        })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="哮喘">
                    <ToggleField
                      label="合并哮喘"
                      checked={caseData.asthma.hasAsthma}
                      onChange={(value) =>
                        updateSection("asthma", { hasAsthma: value })
                      }
                    />
                    <ToggleField
                      label="近期发作"
                      checked={caseData.asthma.recentAttack}
                      onChange={(value) =>
                        updateSection("asthma", { recentAttack: value })
                      }
                    />
                    <ToggleField
                      label="正在使用吸入药"
                      checked={caseData.asthma.inhaledMedication}
                      onChange={(value) =>
                        updateSection("asthma", { inhaledMedication: value })
                      }
                    />
                    <ToggleField
                      label="频繁使用 β2 激动剂"
                      checked={caseData.asthma.frequentBeta2Agonist}
                      onChange={(value) =>
                        updateSection("asthma", {
                          frequentBeta2Agonist: value,
                        })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="痛风 / 高尿酸">
                    <ToggleField
                      label="合并痛风"
                      checked={caseData.gout.hasGout}
                      onChange={(value) =>
                        updateSection("gout", { hasGout: value })
                      }
                    />
                    <ToggleField
                      label="高尿酸血症"
                      checked={caseData.gout.hyperuricemia}
                      onChange={(value) =>
                        updateSection("gout", { hyperuricemia: value })
                      }
                    />
                    <NumberField
                      label="血尿酸"
                      value={caseData.gout.uricAcid}
                      onChange={(value) =>
                        updateSection("gout", { uricAcid: value })
                      }
                    />
                    <ToggleField
                      label="既往痛风发作"
                      checked={caseData.gout.previousAttack}
                      onChange={(value) =>
                        updateSection("gout", { previousAttack: value })
                      }
                    />
                    <ToggleField
                      label="当前在用噻嗪类"
                      checked={caseData.gout.onThiazide}
                      onChange={(value) =>
                        updateSection("gout", { onThiazide: value })
                      }
                    />
                  </SubPanel>

                  <SubPanel title="妊娠 / 备孕">
                    <ToggleField
                      label="是否妊娠"
                      checked={caseData.pregnancy.pregnant}
                      onChange={(value) =>
                        updateSection("pregnancy", {
                          pregnant: value,
                          planning: value ? false : caseData.pregnancy.planning,
                        })
                      }
                    />
                    <ToggleField
                      label="是否备孕"
                      checked={caseData.pregnancy.planning}
                      onChange={(value) =>
                        updateSection("pregnancy", {
                          planning: value,
                          pregnant: value ? false : caseData.pregnancy.pregnant,
                        })
                      }
                    />
                    <NumberField
                      label="孕周"
                      value={caseData.pregnancy.gestationalWeeks}
                      onChange={(value) =>
                        updateSection("pregnancy", {
                          gestationalWeeks: value,
                        })
                      }
                    />
                  </SubPanel>
                </div>
              </SectionCard>

              <SectionCard
                title="当前用药与既往风险"
                subtitle="用于处理多药冲突、重复推荐和安全提醒"
              >
                <div className="dual-grid">
                  <div className="stack compact">
                    <h3>当前用药</h3>
                    <div className="field-grid two-columns">
                      <ToggleField
                        label="当前 ACEI"
                        checked={caseData.currentMedication.acei}
                        onChange={(value) =>
                          updateSection("currentMedication", { acei: value })
                        }
                      />
                      <ToggleField
                        label="当前 ARB"
                        checked={caseData.currentMedication.arb}
                        onChange={(value) =>
                          updateSection("currentMedication", { arb: value })
                        }
                      />
                      <ToggleField
                        label="当前 CCB"
                        checked={caseData.currentMedication.ccb}
                        onChange={(value) =>
                          updateSection("currentMedication", { ccb: value })
                        }
                      />
                      <ToggleField
                        label="当前噻嗪类"
                        checked={caseData.currentMedication.thiazide}
                        onChange={(value) =>
                          updateSection("currentMedication", { thiazide: value })
                        }
                      />
                      <ToggleField
                        label="当前袢利尿剂"
                        checked={caseData.currentMedication.loop}
                        onChange={(value) =>
                          updateSection("currentMedication", { loop: value })
                        }
                      />
                      <ToggleField
                        label="当前 β 阻滞剂"
                        checked={caseData.currentMedication.betaBlocker}
                        onChange={(value) =>
                          updateSection("currentMedication", {
                            betaBlocker: value,
                          })
                        }
                      />
                      <ToggleField
                        label="当前 MRA"
                        checked={caseData.currentMedication.mra}
                        onChange={(value) =>
                          updateSection("currentMedication", { mra: value })
                        }
                      />
                      <ToggleField
                        label="当前 NSAIDs"
                        checked={caseData.currentMedication.nsaids}
                        onChange={(value) =>
                          updateSection("currentMedication", { nsaids: value })
                        }
                      />
                      <ToggleField
                        label="当前降糖药"
                        checked={caseData.currentMedication.glucoseLowering}
                        onChange={(value) =>
                          updateSection("currentMedication", {
                            glucoseLowering: value,
                          })
                        }
                      />
                      <ToggleField
                        label="当前吸入药"
                        checked={caseData.currentMedication.inhaledMedication}
                        onChange={(value) =>
                          updateSection("currentMedication", {
                            inhaledMedication: value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="stack compact">
                    <h3>既往不良反应与风险</h3>
                    <div className="field-grid">
                      <ToggleField
                        label="ACEI 咳嗽史"
                        checked={caseData.risk.aceiCough}
                        onChange={(value) =>
                          updateSection("risk", { aceiCough: value })
                        }
                      />
                      <ToggleField
                        label="既往高钾史"
                        checked={caseData.risk.hyperkalemiaHistory}
                        onChange={(value) =>
                          updateSection("risk", {
                            hyperkalemiaHistory: value,
                          })
                        }
                      />
                      <ToggleField
                        label="既往肾功能恶化史"
                        checked={caseData.risk.renalDeteriorationHistory}
                        onChange={(value) =>
                          updateSection("risk", {
                            renalDeteriorationHistory: value,
                          })
                        }
                      />
                      <ToggleField
                        label="既往明显低血压史"
                        checked={caseData.risk.hypotensionHistory}
                        onChange={(value) =>
                          updateSection("risk", { hypotensionHistory: value })
                        }
                      />
                      <TextField
                        label="药物过敏史"
                        value={caseData.risk.allergies}
                        placeholder="可填写文字说明"
                        onChange={(value) =>
                          updateSection("risk", { allergies: value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>
            </main>

            <aside className="stack sidebar-stack">
              <SectionCard
                title="当前病例摘要"
                subtitle="答辩时可快速说明结构化输入"
                tone="accent"
              >
                <div className="summary-block">
                  <p className="case-title">{caseData.base.patientName}</p>
                  <div className="chip-row">
                    {(result?.inputSummary.length
                      ? result.inputSummary
                      : ["高血压"]
                    ).map((item) => (
                      <span className="pill" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="推荐预览"
                subtitle="无需切页也能先看 Top 3 方向"
              >
                <div className="stack compact">
                  {(result?.topClasses || []).slice(0, 3).map((item, index) => (
                    <div className="preview-row" key={item.classId}>
                      <div>
                        <span className="ranking-index">0{index + 1}</span>
                        <strong>{item.classLabel}</strong>
                      </div>
                      <span className="score-tag">{item.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="示例病例"
                subtitle="可一键切换到设计文档中的典型场景"
              >
                <div className="stack compact">
                  {sampleCases.map((item) => (
                    <button
                      className="sample-button"
                      key={item.id}
                      onClick={() => loadCase(item)}
                    >
                      <div>
                        <strong>{item.base.patientName}</strong>
                        <span>{item.base.age} 岁</span>
                      </div>
                      <span>加载</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="病例管理"
                subtitle="保留最近保存的病例，支持回放"
              >
                <div className="stack compact">
                  {savedCases.length === 0 && (
                    <div className="empty-state">还没有保存的病例</div>
                  )}
                  {savedCases.map((item) => (
                    <button
                      className="saved-case-row"
                      key={`${item.id}-${item.createdAt}`}
                      onClick={() => loadCase(item)}
                    >
                      <div>
                        <strong>{item.base.patientName}</strong>
                        <span>{formatTime(item.createdAt)}</span>
                      </div>
                      <span>{item.base.age || "--"} 岁</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </aside>
          </div>
        )}

        {activeTab === "results" && (
          <div className="results-layout">
            <div className="stack">
              <SectionCard
                title="输入摘要"
                subtitle="面向答辩展示的结构化病例概览"
              >
                <div className="chip-row">
                  {result?.inputSummary.map((item) => (
                    <span className="pill" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="推荐 Top 3"
                subtitle="优先展示药物类别，再配代表药名"
              >
                <div className="recommendation-grid">
                  {result?.topClasses.map((item, index) => (
                    <div className="recommend-card" key={item.classId}>
                      <span className="recommend-rank">Top {index + 1}</span>
                      <h3>{item.classLabel}</h3>
                      <p>{item.drugs.slice(0, 3).join(" / ")}</p>
                      <div className="score-strip">
                        <span>综合得分</span>
                        <strong>{item.score.toFixed(1)}</strong>
                      </div>
                      <div className="micro-copy">
                        {item.reasons.slice(0, 3).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <div className="dual-grid">
                <SectionCard
                  title="排除药物"
                  subtitle="命中禁忌或重复推荐逻辑"
                  tone="warning"
                >
                  <div className="stack compact">
                    {result?.excludedDrugs.map((item) => (
                      <div className="decision-row danger" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.classLabel}</span>
                        </div>
                        <p>{item.reasons[0]}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="慎用药物"
                  subtitle="提示需要额外评估的风险点"
                  tone="caution"
                >
                  <div className="stack compact">
                    {result?.cautionDrugs.length ? (
                      result.cautionDrugs.map((item) => (
                        <div className="decision-row caution" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.classLabel}</span>
                          </div>
                          <p>{item.reasons[0]}</p>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">当前未触发额外慎用提示</div>
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>

            <div className="stack">
              <SectionCard
                title="命中规则"
                subtitle="完整展示本次推理路径和规则来源"
              >
                <div className="stack compact">
                  {result?.ruleHits.map((item) => (
                    <div className="rule-card" key={item.ruleId}>
                      <div className="rule-head">
                        <span className="rule-id">{item.ruleId}</span>
                        <span className={`action-tag ${item.action}`}>
                          {actionLabel(item.action)}
                        </span>
                      </div>
                      <strong>{item.ruleName}</strong>
                      <p>{item.rationale}</p>
                      <div className="rule-meta">
                        <span>依据：{item.evidence.join(" / ")}</span>
                        <span>来源：{item.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="监测建议"
                subtitle="把 monitor 逻辑直接转化为临床提醒"
                tone="accent"
              >
                <div className="monitor-list">
                  {result?.monitorSuggestions.map((item) => (
                    <div className="monitor-item" key={item}>
                      <FlaskConical size={16} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === "graph" && result && (
          <SectionCard
            title="三层解释图谱"
            subtitle="左侧是患者特征，中间是命中规则，右侧是药物节点"
          >
            <ExplanationGraph nodes={result.graphNodes} edges={result.graphEdges} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function actionLabel(action: RecommendationResult["ruleHits"][number]["action"]) {
  if (action === "strong_confirm") {
    return "强支持";
  }
  if (action === "confirm") {
    return "支持";
  }
  if (action === "exclude") {
    return "排除";
  }
  if (action === "caution") {
    return "慎用";
  }
  return "监测";
}

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{props.icon}</div>
      <div>
        <span>{props.label}</span>
        <strong>{props.value}</strong>
      </div>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={props.active ? "tab-button active" : "tab-button"}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function SectionCard(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  tone?: "default" | "accent" | "warning" | "caution";
}) {
  return (
    <section className={`section-card ${props.tone || "default"}`}>
      <div className="section-head">
        <div>
          <h2>{props.title}</h2>
          <p>{props.subtitle}</p>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function SubPanel(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="sub-panel">
      <h3>{props.title}</h3>
      <div className="stack compact">{props.children}</div>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        onChange={(event) =>
          props.onChange(
            event.target.value === "" ? "" : Number(event.target.value),
          )
        }
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-field">
      <span>{props.label}</span>
      <button
        className={props.checked ? "toggle-switch active" : "toggle-switch"}
        type="button"
        onClick={() => props.onChange(!props.checked)}
      >
        <span />
      </button>
    </label>
  );
}

function ExplanationGraph(props: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const involvedIds = new Set<string>();
  props.edges.forEach((edge) => {
    involvedIds.add(edge.source);
    involvedIds.add(edge.target);
  });

  const visibleNodes = props.nodes.filter((node) => involvedIds.has(node.id));
  const featureNodes = visibleNodes.filter((node) => node.type === "feature");
  const ruleNodes = visibleNodes.filter((node) => node.type === "rule");
  const drugNodes = visibleNodes.filter((node) => node.type === "drug");

  const height =
    Math.max(featureNodes.length, ruleNodes.length, drugNodes.length) * 90 + 80;

  const layout = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  featureNodes.forEach((node, index) => {
    layout.set(node.id, { x: 120, y: 70 + index * 90 });
  });
  ruleNodes.forEach((node, index) => {
    layout.set(node.id, { x: 510, y: 70 + index * 90 });
  });
  drugNodes.forEach((node, index) => {
    layout.set(node.id, { x: 900, y: 70 + index * 90 });
  });

  return (
    <div className="graph-shell">
      <div className="graph-legend">
        <Legend color={relationColor.confirm} label="支持" />
        <Legend color={relationColor.exclude} label="排除" />
        <Legend color={relationColor.caution} label="慎用" />
        <Legend color={relationColor.monitor} label="特征连接 / 监测" />
      </div>
      <svg className="graph-canvas" viewBox={`0 0 1020 ${height}`}>
        {props.edges.map((edge) => {
          const source = layout.get(edge.source);
          const target = layout.get(edge.target);

          if (!source || !target) {
            return null;
          }

          const startX = source.x + 120;
          const startY = source.y + 24;
          const endX = target.x;
          const endY = target.y + 24;
          const curve = `M ${startX} ${startY} C ${startX + 120} ${startY}, ${endX - 120} ${endY}, ${endX} ${endY}`;

          return (
            <path
              key={edge.id}
              d={curve}
              fill="none"
              stroke={relationColor[edge.relation]}
              strokeLinecap="round"
              strokeOpacity={0.82}
              strokeWidth={Math.max(2, edge.weight * 4)}
            />
          );
        })}
        {visibleNodes.map((node) => {
          const position = layout.get(node.id);
          if (!position) {
            return null;
          }
          return (
            <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
              <rect
                width="120"
                height="48"
                rx="16"
                fill={
                  node.type === "feature"
                    ? "rgba(118, 176, 255, 0.18)"
                    : node.type === "rule"
                      ? "rgba(157, 120, 255, 0.18)"
                      : "rgba(97, 255, 207, 0.18)"
                }
                stroke="rgba(255,255,255,0.25)"
              />
              <text
                x="60"
                y="28"
                textAnchor="middle"
                fill="#f4f7fb"
                fontSize="12"
                fontWeight="600"
              >
                {truncate(node.label, 16)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Legend(props: { color: string; label: string }) {
  return (
    <div className="legend-item">
      <span style={{ background: props.color }} />
      <strong>{props.label}</strong>
    </div>
  );
}

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export default App;
