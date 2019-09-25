import Axios, { AxiosPromise } from 'axios';
import _ from 'lodash';
import { toJapaneseFromSecond } from '../utils/time';

const REPORT_BASE = 'https://toggl.com/reports/api/v2';

namespace Api {
  export interface Item {
    title: {
      time_entry: string;
    };
    time: number;
  }

  export interface SummaryTitle {
    project: string;
    client: string;
  }

  export interface Summary {
    id: number;
    title: SummaryTitle;
    time: number;
    items: Item[];
  }

  export interface Root {
    data: Summary[];
  }

  export class Client {
    token: string;

    constructor(token: string) {
      this.token = token;
    }

    summary(workspaceId: number, since: string, until: string): AxiosPromise<Root> {
      return Axios.get(
        `${REPORT_BASE}/summary?workspace_id=${workspaceId}&since=${since}&until=${until}&user_agent=togowl`,
        {
          auth: {
            username: this.token,
            password: 'api_token',
          },
        },
      );
    }
  }
}

class ProjectReport {
  constructor(public projectName: string, public seconds: number) {}

  get timeAsJapanese(): string {
    return toJapaneseFromSecond(this.seconds);
  }
}

export class ClientReport {
  constructor(public client: string, public projects: ProjectReport[], public seconds: number) {}

  get timeAsJapanese(): string {
    return toJapaneseFromSecond(this.seconds);
  }
}

const toClientReport = (summaries: Api.Summary[]): ClientReport =>
  new ClientReport(
    summaries[0].title.client,
    summaries.map(x => new ProjectReport(x.title.project, x.time / 1000)),
    _.sumBy(summaries, x => x.time) / 1000,
  );

/**
 * デイリーレポートを取得します (クライアントが設定されているものに限る)
 * @param token Togglトークン
 * @param workSpaceId TogglワークスペースID
 * @param date 日付(yyyy-MM-dd)
 */
export function fetchDailyReport(token: string, workSpaceId: number, date: string): Promise<ClientReport[]> {
  const client = new Api.Client(token);
  return client.summary(workSpaceId, date, date).then(x =>
    _(x.data.data)
      .groupBy(s => s.title.client)
      .mapValues(ss => _.orderBy(ss, s => s.time, 'desc'))
      .map(toClientReport)
      .filter(r => !!r.client)
      .orderBy(r => r.seconds, 'desc')
      .value(),
  );
}