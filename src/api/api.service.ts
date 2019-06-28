import { Injectable } from '@nestjs/common';
import axios from 'axios';

const crawlers = require('crawler-user-agents');

@Injectable()
export class ApiService {
    private userAgentsList: string[] = [];

    constructor() {
        this.setUserAgentsList();
    }

    sendGetRequest(url: string, params?: object, opts?: object): Promise<any> {
        return axios({
            method: 'get',
            headers: {
                'User-Agent': this.getRandomUserAgent(),
                ...opts,
            },
            url,
            params,
        });
    }

    sendPostRequest(url: string, data?: object, opts?: object): Promise<any> {
        return axios({
            method: 'post',
            headers: {
                'User-Agent': this.getRandomUserAgent(),
                ...opts,
            },
            url,
            data,
        });
    }

    getRandomUserAgent() {
        const { userAgentsList } = this;
        const randomIndex = Math.floor(Math.random() * userAgentsList.length);
        return userAgentsList[randomIndex];
    }

    private setUserAgentsList() {
        for (const item of crawlers) {
            this.userAgentsList = this.userAgentsList.concat(item.instances);
        }
    }
}
