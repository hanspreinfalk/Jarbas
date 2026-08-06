export type Org = {
  id: string;
  name: string;
  detail: string;
};

export const MOCK_ORGS: Org[] = [
  {
    id: "meridian",
    name: "Meridian Partners",
    detail: "28 employees · active",
  },
  {
    id: "summit",
    name: "Summit Underwriters",
    detail: "64 employees · demo",
  },
  {
    id: "harbor",
    name: "Harbor Mutual Group",
    detail: "112 employees · demo",
  },
  {
    id: "deploy",
    name: "Deployment Company",
    detail: "12 employees · workspace",
  },
];
