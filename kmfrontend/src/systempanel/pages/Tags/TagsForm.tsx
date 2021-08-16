import { MinusCircleOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Cascader, Checkbox, Col, Divider, Form, Input, InputNumber,message, Row, Select, Tag, Tooltip } from 'antd';
import { FormInstance } from 'antd/lib/form';
import i18next from 'i18next';
import React, { Component } from 'react';

import { DBTag } from '../../../../../src/lib/types/database/tag';
import { getLanguagesInLocaleFromCode, getListLanguagesInLocale } from '../../../utils/isoLanguages';
import { commandBackend } from '../../../utils/socket';
import { tagTypes } from '../../../utils/tagTypes';
import EditableTagGroupAlias from '../../components/EditableTagGroupAlias';

interface TagsFormProps {
	tags: Array<DBTag>,
	tag: DBTag,
	save: (tag: DBTag) => void,
	handleCopy: (tid, repo) => void;
	mergeAction: (tid1: string, tid2: string) => void,
}

interface TagsFormState {
	i18n: any[];
	languages: any[];
	selectVisible: boolean;
	mergeSelection: string;
	repositoriesValue: string[];
	repoToCopySong: string;
}

class TagForm extends Component<TagsFormProps, TagsFormState> {
	formRef = React.createRef<FormInstance>();
	select: any;

	constructor(props) {
		super(props);
		this.getRepositories();

		this.state = {
			i18n: this.props.tag?.i18n ? Object.keys(this.props.tag.i18n) : [],
			languages: getListLanguagesInLocale(),
			selectVisible: false,
			mergeSelection: '',
			repositoriesValue: null,
			repoToCopySong: null
		};
	}

	getRepositories = async () => {
		const res = await commandBackend('getRepos');
		this.setState({ repositoriesValue: res.map(repo => repo.Name) }, () =>
			this.formRef.current?.setFieldsValue({
				repository: this.props.tag?.repository ? this.props.tag.repository :
					(this.state.repositoriesValue ? this.state.repositoriesValue[0] : null)
			})
		);
	};

	showSelect = () => {
		this.setState({ selectVisible: true }, () => this.select.focus());
	};

	handleSubmit = (values) => {
		if (this.state.i18n.length > 0) {
			const i18nField = {};
			for (const lang of this.state.i18n) {
				i18nField[lang] = values[`lang_${lang}`];
				delete values[`lang_${lang}`];
			}
			values.i18n = i18nField;
			values.tid = this.props.tag?.tid;
			this.props.save(values);
		} else {
			message.error(i18next.t('TAGS.LANG_ERROR'));
		}
	};

	handleTagMergeSelection = (value) => {
		this.setState({ mergeSelection: value[1] });
	}

	handleTagMerge = (e) => {
		this.props.mergeAction(this.props.tag.tid, this.state.mergeSelection);
	}

	// i18n dynamic management
	addLang = (lang) => {
		if (!this.state.i18n.includes(lang)) {
			const newI18n = this.state.i18n.concat([lang]);
			this.setState({ i18n: newI18n });
		}
		this.setState({
			selectVisible: false
		});
	};

	removeLang = (lang) => {
		if (this.state.i18n.includes(lang)) {
			const newI18n = this.state.i18n.filter(e => e !== lang);
			this.setState({ i18n: newI18n });
		}
	};

	mergeCascaderOption = () => {
		const options = Object.keys(tagTypes).map(type => {
			const typeID = tagTypes[type].type;

			const option = {
				value: typeID,
				label: i18next.t(`TAG_TYPES.${type}`),
				children: []
			};
			for (const tag of this.props.tags) {
				if (tag.tid !== this.props.tag.tid) {
					if (tag.types.length && tag.types.indexOf(typeID) >= 0)
						option.children.push({
							value: tag.tid,
							label: tag.name,
						});
				}
			}
			return option;
		});
		return options;
	}

	mergeCascaderFilter = function (inputValue, path) {
		return path.some(option => option.label.toLowerCase().indexOf(inputValue.toLowerCase()) > -1);
	}

	render() {
		const initialValues = {
			name: this.props.tag?.name,
			short: this.props.tag?.short,
			types: this.props.tag?.types ? this.props.tag.types : [],
			repository: this.props.tag?.repository ? this.props.tag.repository :
				(this.state.repositoriesValue ? this.state.repositoriesValue[0] : null),
			aliases: this.props.tag?.aliases,
			problematic: this.props.tag?.problematic,
			noLiveDownload: this.props.tag?.noLiveDownload,
			priority: this.props.tag?.priority ? this.props.tag?.priority : 10,
			karaFileTag: this.props.tag?.karaFileTag,
		};
		for (const lang of this.state.i18n) {
			initialValues['lang_' + lang] = this.props.tag?.i18n[lang];
		}
		return (
			<Form
				ref={this.formRef}
				onFinish={this.handleSubmit}
				className='tag-form'
				initialValues={initialValues}
			>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.NAME')}&nbsp;
							<Tooltip title={i18next.t('TAGS.NAME_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					name="name"
					rules={[{
						required: true,
						message: i18next.t('TAGS.NAME_REQUIRED')
					}]}
				>
					<Input style={{ maxWidth: '40%', minWidth: '150px' }}
						placeholder={i18next.t('TAGS.NAME')}
					/>
				</Form.Item>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.SHORT_NAME')}&nbsp;
							<Tooltip title={i18next.t('TAGS.SHORT_NAME_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					name="short"
				>
					<Input style={{ maxWidth: '40%', minWidth: '150px' }}
						placeholder={i18next.t('TAGS.SHORT_NAME')}
					/>
				</Form.Item>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.KARAFILETAG')}&nbsp;
							<Tooltip title={i18next.t('TAGS.KARAFILETAG_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					name="karafileTag"
				>
					<Input style={{ maxWidth: '40%', minWidth: '150px' }}
						placeholder={i18next.t('TAGS.KARAFILETAG')}
					/>
				</Form.Item>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.TYPES')}&nbsp;
							<Tooltip title={i18next.t('TAGS.TYPES_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					name="types"
					required={true}
				>
					<Select style={{ maxWidth: '40%', minWidth: '150px' }} mode="multiple" placeholder={i18next.t('TAGS.TYPES')} showSearch={false}>
						{Object.keys(tagTypes).map(type => {
							const value = tagTypes[type].type;
							return <Select.Option key={value} value={value}>
								{i18next.t(`TAG_TYPES.${type}`)}
							</Select.Option>;
						})
						}
					</Select>
				</Form.Item>
				{this.state.repositoriesValue ?
					<Form.Item
						label={i18next.t('TAGS.REPOSITORY')}
						labelCol={{ flex: '0 1 300px' }}
						rules={[{
							required: true,
							message: i18next.t('TAGS.REPOSITORY_REQUIRED')
						}]}
						name="repository"
					>
						<Select disabled={this.props.tag?.repository !== undefined}
							style={{ maxWidth: '20%', minWidth: '150px' }} placeholder={i18next.t('TAGS.REPOSITORY')}>
							{this.state.repositoriesValue.map(repo => {
								return <Select.Option key={repo} value={repo}>{repo}</Select.Option>;
							})
							}
						</Select>
					</Form.Item> : null
				}
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.ALIASES')}&nbsp;
							<Tooltip title={i18next.t('TAGS.ALIASES_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					name="aliases"
				>
					<EditableTagGroupAlias
						onChange={(tags) => this.formRef.current?.setFieldsValue({ aliases: tags })}
					/>
				</Form.Item>
				<Form.Item
					labelCol={{ flex: '150px' }}
					label={(<span>{i18next.t('TAGS.I18N')}&nbsp;
						<Tooltip title={i18next.t('TAGS.I18N_TOOLTIP')}>
							<QuestionCircleOutlined />
						</Tooltip>
					</span>)}
				>
				</Form.Item>

				{this.state.i18n.map(langKey => (
					<Row key={langKey} style={{ maxWidth: '65%', minWidth: '150px' }}>
						<Col style={{ width: '80%' }}>
							<Form.Item
								label={getLanguagesInLocaleFromCode(langKey)}
								labelCol={{ flex: '0 1 300px' }}
								name={`lang_${langKey}`}
								rules={[{
									required: true,
									message: i18next.t('TAGS.I18N_ERROR')
								}]}
							>
								<Input placeholder={i18next.t('TAGS.I18N_NAME')} />
							</Form.Item>
						</Col>
						<Col style={{ marginLeft: '10px' }}>
							{Object.keys(this.state.i18n).length > 1 ? (
								<Tooltip title={i18next.t('TAGS.I18N_DELETE')}>
									<MinusCircleOutlined
										className="dynamic-delete-button"
										onClick={() => this.removeLang(langKey)}
									/>
								</Tooltip>
							) : null}
						</Col>
					</Row>
				))}
				<Form.Item
					label={i18next.t('TAGS.I18N_SELECT')}
					labelCol={{ flex: '0 1 300px' }}
				>
					{this.state.selectVisible ?
						<Select style={{ maxWidth: '40%', minWidth: '150px' }}
							showSearch
							optionFilterProp="children"
							ref={select => this.select = select}
							onChange={value => this.addLang(value)}>
							{this.state.languages.map(lang => (
								<Select.Option key={lang.value} value={lang.value}>
									{lang.label} ({lang.value.toUpperCase()})
								</Select.Option>))}
						</Select> :
						<Tag
							onClick={this.showSelect}
							style={{ borderStyle: 'dashed' }}
						>
							<PlusOutlined />{i18next.t('ADD')}
						</Tag>
					}
				</Form.Item>
				<Form.Item hasFeedback
					label={(
						<span>{i18next.t('TAGS.PRIORITY')}&nbsp;
							<Tooltip title={i18next.t('TAGS.PRIORITY_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 200px' }}
					wrapperCol={{ span: 2 }}
					name="priority"
				>
					<InputNumber
						required={true}
						min={0}
						placeholder='Priority'
						style={{ width: '100%' }}
					/>
				</Form.Item>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.PROBLEMATIC')}&nbsp;
							<Tooltip title={i18next.t('TAGS.PROBLEMATIC_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					valuePropName="checked"
					name="problematic"
				>
					<Checkbox />
				</Form.Item>
				<Form.Item
					label={(
						<span>{i18next.t('TAGS.NOLIVEDOWNLOAD')}&nbsp;
							<Tooltip title={i18next.t('TAGS.NOLIVEDOWNLOAD_TOOLTIP')}>
								<QuestionCircleOutlined />
							</Tooltip>
						</span>
					)}
					labelCol={{ flex: '0 1 300px' }}
					valuePropName="checked"
					name="noLiveDownload"
				>
					<Checkbox />
				</Form.Item>
				<Form.Item wrapperCol={{ flex: '45%' }} style={{ textAlign: 'right' }}>
					<Button type='primary' htmlType='submit'
						className='tags-form-button'>{i18next.t('SUBMIT')}</Button>
				</Form.Item>
				{this.props.tag ?
					<>
						<Divider />
						<Form.Item
							label={(
								<span>{i18next.t('TAGS.MERGE_WITH')}&nbsp;
									<Tooltip title={i18next.t('TAGS.MERGE_WITH_TOOLTIP')}>
										<QuestionCircleOutlined />
									</Tooltip>
								</span>
							)}
							labelCol={{ flex: '0 1 300px' }}
						>
							<Cascader style={{ maxWidth: '40%', minWidth: '150px' }}
								options={this.mergeCascaderOption()}
								showSearch={{ filter: this.mergeCascaderFilter }}
								onChange={this.handleTagMergeSelection}
								placeholder={i18next.t('TAGS.MERGE_WITH_SELECT')} />
						</Form.Item>

						<Form.Item
							wrapperCol={{ span: 8, offset: 3 }}
							style={{ textAlign: 'right' }}
						>
							<Button type="primary" danger onClick={this.handleTagMerge}>
								{i18next.t('TAGS.MERGE_WITH_BUTTON')}
							</Button>
							<Alert style={{ textAlign: 'left', marginTop: '20px' }}
								message={i18next.t('TAGS.MERGE_ABOUT')}
								description={i18next.t('TAGS.MERGE_ABOUT_MESSAGE')}
								type="warning"
							/>

						</Form.Item>
					</> : null
				}
				<Divider />
				{this.state.repositoriesValue && this.props.tag?.repository ?
					<React.Fragment>
						<Form.Item hasFeedback
							label={i18next.t('TAGS.REPOSITORY')}
							labelCol={{ flex: '0 1 200px' }}
							wrapperCol={{ span: 8 }}
						>
							<Select placeholder={i18next.t('TAGS.REPOSITORY')} onChange={(value: string) => this.setState({ repoToCopySong: value })}>
								{this.state.repositoriesValue.filter(value => value !== this.props.tag.repository).map(repo => {
									return <Select.Option key={repo} value={repo}>{repo}</Select.Option>;
								})
								}
							</Select>
						</Form.Item>

						<Form.Item
							wrapperCol={{ span: 8, offset: 3 }}
							style={{ textAlign: 'right' }}
						>
							<Button disabled={!this.state.repoToCopySong} type="primary" danger
								onClick={() => this.props.handleCopy(this.props.tag.tid, this.state.repoToCopySong)}>
								{i18next.t('TAGS.COPY_TAG')}
							</Button>
						</Form.Item>
					</React.Fragment> : null
				}
			</Form>
		);
	}
}

export default TagForm;
