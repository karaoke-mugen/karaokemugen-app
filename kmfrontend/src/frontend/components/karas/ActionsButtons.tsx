import './ActionsButtons.scss';

import i18next from 'i18next';
import React, { Component } from 'react';

import GlobalContext from '../../../store/context';
import { nonStandardPlaylists } from '../../../utils/tools';
import { KaraElement } from '../../types/kara';

interface IProps {
	scope: string;
	side: number;
	isHeader?: boolean;
	plaid: string;
	plaidTo: string;
	kara?: KaraElement;
	checkedKaras?: number;
	addKara: (event?: any, pos?: number) => void;
	deleteKara: () => void;
	deleteFavorite: () => void;
	upvoteKara?: () => void;
	refuseKara: () => void;
	acceptKara: () => void;
}

class ActionsButtons extends Component<IProps, unknown> {
	static contextType = GlobalContext;
	context: React.ContextType<typeof GlobalContext>

	onRightClickAdd = (e: any) => {
		if (this.props.scope === 'admin') {
			e.preventDefault();
			e.stopPropagation();
			this.props.addKara(e, -1);
		}
	};

	render() {
		const classValue = this.props.isHeader ? 'btn btn-default karaLineButton' : 'btn btn-sm btn-action karaLineButton';
		return (
			<>
				{this.props.scope === 'admin'
					&& this.props.plaid === this.context.globalState.settings.data.state.publicPlaid
					&& this.props.plaidTo === this.context.globalState.settings.data.state.currentPlaid ?
					<button title={i18next.t(this.props.isHeader ? 'TOOLTIP_REFUSE_SELECT_KARA' : 'TOOLTIP_REFUSE_KARA')}
						className={`${classValue} ${this.props.kara?.flag_refused ? 'off' : ''}`}
						onClick={this.props.refuseKara}>
						<i className="fas fa-times" />
					</button> : null
				}

				{this.props.scope === 'admin'
					&& this.props.plaid === this.context.globalState.settings.data.state.publicPlaid
					&& this.props.plaidTo === this.context.globalState.settings.data.state.currentPlaid ?
					<button
						title={i18next.t(this.props.isHeader ? 'TOOLTIP_ACCEPT_SELECT_KARA' : 'TOOLTIP_ACCEPT_KARA')}
						className={`${classValue} ${this.props.kara?.flag_accepted ? 'on' : ''}`}
						onClick={this.props.acceptKara}>
						<i className="fas fa-check" />
					</button> : null
				}

				{this.props.plaid !== nonStandardPlaylists.favorites
					&& ((this.props.scope === 'admin' && this.props.plaid !== nonStandardPlaylists.library
						&& !(this.props.isHeader && this.props.plaid === nonStandardPlaylists.blacklist)
						&& !(this.props.plaid === this.context.globalState.settings.data.state.publicPlaid
							&& this.props.plaidTo === this.context.globalState.settings.data.state.currentPlaid))
						|| (this.props.scope !== 'admin' && !this.props.kara?.flag_dejavu && !this.props.kara?.flag_playing
							&& (this.props.kara?.my_public_plc_id && this.props.kara?.my_public_plc_id[0]
								|| (this.props.plaid === this.context.globalState.settings.data.state.publicPlaid
									&& this.props.kara.username === this.context.globalState.auth.data.username)))) ?
					<button title={i18next.t(this.props.isHeader ? 'TOOLTIP_DELETE_SELECT_KARA' : 'TOOLTIP_DELETEKARA')}
						disabled={this.props?.checkedKaras === 0}
						className={classValue} onClick={this.props.deleteKara}>
						<i className="fas fa-eraser" />
					</button> : null
				}

				{this.props.plaid === nonStandardPlaylists.favorites ?
					<button title={i18next.t(this.props.isHeader ? 'TOOLTIP_DELETE_SELECT_FAVS' : 'TOOLTIP_DELETE_FAVS')}
						className={classValue + ' yellow'} onClick={this.props.deleteFavorite}>
						<i className="fas fa-star" />
					</button> : null
				}

				{(this.props.scope === 'admin' && this.props.plaidTo !== nonStandardPlaylists.library
					&& this.props.plaidTo !== nonStandardPlaylists.favorites
					&& !(this.props.plaid === this.context.globalState.settings.data.state.publicPlaid
						&& this.props.plaidTo === this.context.globalState.settings.data.state.currentPlaid))
					|| (this.props.scope === 'public'
						&& this.context?.globalState.settings.data.config?.Frontend?.Mode === 2
						&& this.props.plaid !== this.context.globalState.settings.data.state.publicPlaid
						&& this.props.plaid !== this.context.globalState.settings.data.state.currentPlaid
						&& (!this.props.kara?.public_plc_id || !this.props.kara?.public_plc_id[0])) ?
					<button
						title={this.props.isHeader ? i18next.t('TOOLTIP_ADD_SELECT_KARA') :
							`${i18next.t('TOOLTIP_ADDKARA')}${(this.props.scope === 'admin' ? ' - ' + i18next.t('TOOLTIP_ADDKARA_ADMIN') : '')}`}
						className={classValue} onContextMenu={this.onRightClickAdd}
						onClick={this.props.addKara}
						disabled={this.props?.checkedKaras === 0}>
						<i className="fas fa-plus" />
					</button> : null
				}

				{this.props.scope !== 'admin' && ((this.props.kara.public_plc_id?.length > 0
					&& this.props.kara.my_public_plc_id?.length === 0) || this.props.kara?.upvotes > 0) ?
					<button
						title={i18next.t('TOOLTIP_UPVOTE')}
						className={`${classValue} upvoteKara`}
						onClick={this.props.upvoteKara}
						disabled={this.props.kara.my_public_plc_id?.length > 0}>
						<i className={`fas fa-thumbs-up ${this.props.kara?.flag_upvoted ? 'currentUpvote' : ''}
						${this.props.kara?.upvotes > 0 ? ' upvotes' : ''}`} />
						{this.props.kara?.upvotes > 0 && this.props.kara?.upvotes}
					</button> : null
				}
			</>
		);
	}
}

export default ActionsButtons;
